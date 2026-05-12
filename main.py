from fastapi import FastAPI, UploadFile, File
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import shutil
import os
from dotenv import load_dotenv
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from groq import Groq

# Load environment variables
load_dotenv()

# --- SETUP ---
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploaded_pdfs"
CHROMA_DIR = "chroma_db"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# 1. Initialize Embeddings (Same as Week 2)
print("Loading AI Embedding model...")
embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

# 2. Initialize the Groq AI Brain
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "your_api_key_here")
client = Groq(api_key=GROQ_API_KEY)

# 3. Load the existing Vector Database
vector_database = Chroma(persist_directory=CHROMA_DIR, embedding_function=embeddings)
print("AI Model and Database loaded successfully!")


# --- WEEK 2 CODE (Keep this so you can still upload PDFs) ---
@app.post("/upload-pdf/")
async def upload_pdf(file: UploadFile = File(...)):
    file_location = f"{UPLOAD_DIR}/{file.filename}"
    with open(file_location, "wb+") as file_object:
        shutil.copyfileobj(file.file, file_object)
        
    loader = PyPDFLoader(file_location)
    pages = loader.load()
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
    chunks = text_splitter.split_documents(pages)
    
    # Add new chunks to the existing database
    vector_database.add_documents(chunks)
    
    return {"status": "PDF uploaded and processed!", "chunks_created": len(chunks)}


# --- NEW ENDPOINT: Get list of uploaded documents ---
@app.get("/get-documents/")
async def get_documents():
    """Returns a list of all uploaded PDF documents"""
    try:
        documents = [f for f in os.listdir(UPLOAD_DIR) if f.endswith('.pdf')]
        return {"documents": documents, "count": len(documents)}
    except Exception as e:
        return {"documents": [], "count": 0, "error": str(e)}


# --- WEEK 3 CODE (The new Chat Endpoint) ---
# This tells FastAPI to expect a JSON with a "question" field
class ChatRequest(BaseModel):
    question: str

@app.post("/chat/")
async def chat_with_pdf(request: ChatRequest):
    
    # Step A: Search the database for relevant chunks based on the question
    print(f"User asked: {request.question}")
    results = vector_database.similarity_search(request.question, k=3) # k=3 means get top 3 chunks
    
    if not results:
        return {"answer": "I'm sorry, I couldn't find any information in the document related to your question. Try uploading a PDF first!"}
    
    # Step B: Format the context for the AI
    context_text = "\n\n".join([doc.page_content for doc in results])
    
    prompt = f"""
    You are an intelligent assistant. Answer the user's question based ONLY on the provided context.
    If the context does not contain the answer, just say "The document does not contain this information."
    
    CONTEXT:
    {context_text}
    
    USER QUESTION:
    {request.question}
    
    ANSWER:
    """
    
    # Step C: Ask the Groq AI (Llama 3) to read the context and answer
    print("Asking Groq Llama 3 for an answer...")
    try:
        chat_completion = client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="llama-3.3-70b-versatile", # This is the free Llama 3 model
        )
        
        answer = chat_completion.choices[0].message.content
        print(f"AI Answered: {answer}")
        
        return {"answer": answer}
    except Exception as e:
        return {"answer": f"Error getting response from AI: {str(e)}"}


# --- HEALTH CHECK ---
@app.get("/health/")
async def health_check():
    return {"status": "✅ Server is running!", "ai_model": "Llama 3.3 70B", "database": "Chroma Vector DB"}


if __name__ == "__main__":
    print("\n🚀 Starting AI Chatbot Server...\n")
    uvicorn.run(app, host="127.0.0.1", port=8000)


if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
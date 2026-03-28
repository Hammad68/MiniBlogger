from fastapi import FastAPI

app = FastAPI()

#  Just for testing purposes
def printMessage():
    return "FastAPI is ready to extend"

@app.get('/')
def main():
    return printMessage()
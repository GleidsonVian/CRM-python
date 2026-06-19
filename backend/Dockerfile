FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p uploads

EXPOSE 8001

CMD ["sh", "-c", "python migrate_add_columns.py && uvicorn main:app --host 0.0.0.0 --port 8001"]

path = r'C:/Users/Gleidson/pasta4/Python/CRM/frontend/src/components/WebhooksView.jsx'
with open(path, 'rb') as f:
    data = f.read()

old = (
    b"'POST /cards':    '{\\n  \"title\": \"Novo neg\xc3\xb3cio\",\\n  \"price\": 1500,\\n  \"stage_id\": 1\\n}',\r\n"
    b"  'PUT /cards/{id}':'{\\n  \"title\": \"Neg\xc3\xb3cio atualizado\",\\n  \"price\": 2000\\n}',\r\n"
    b"  'POST /leads':    '{\\n  \"title\": \"Novo lead\",\\n  \"first_name\": \"Jo\xc3\xa3o\",\\n  \"email\": \"joao@email.com\"\\n}',\r\n"
    b"  'PUT /leads/{id}':'{\\n  \"title\": \"Lead atualizado\"\\n}',"
)

new = (
    b"'POST /cards':    '{\\n  \"title\": \"Novo neg\\u00f3cio\",\\n  \"price\": 1500,\\n  \"stage_id\": 1,\\n  \"custom_fields\": {\\n    \"categoria\": \"B2B\",\\n    \"contrato_assinado\": \"true\"\\n  }\\n}',\r\n"
    b"  'PUT /cards/{id}':'{\\n  \"title\": \"Neg\\u00f3cio atualizado\",\\n  \"price\": 2000,\\n  \"custom_fields\": {\\n    \"categoria\": \"B2C\"\\n  }\\n}',\r\n"
    b"  'POST /leads':    '{\\n  \"title\": \"Novo lead\",\\n  \"first_name\": \"Jo\\u00e3o\",\\n  \"email\": \"joao@email.com\",\\n  \"custom_fields\": {\\n    \"origem_detalhada\": \"Google Ads\"\\n  }\\n}',\r\n"
    b"  'PUT /leads/{id}':'{\\n  \"title\": \"Lead atualizado\",\\n  \"custom_fields\": {\\n    \"origem_detalhada\": \"Indica\\u00e7\\u00e3o\"\\n  }\\n}',"
)

if old in data:
    data = data.replace(old, new)
    with open(path, 'wb') as f:
        f.write(data)
    print("Fixed!")
else:
    print("Pattern not found")
    # show context
    idx = data.find(b"'POST /cards'")
    print(repr(data[idx:idx+250]))

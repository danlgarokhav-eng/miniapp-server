FROM python:3.10

# Создаём рабочую директорию
WORKDIR /app

# Копируем зависимости отдельно — это ускоряет кэширование
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# Копируем весь проект в /app
COPY . /app

# Явно указываем PYTHONPATH, чтобы Railway не искал модули в других местах
ENV PYTHONPATH=/app

# Запускаем gunicorn, указывая правильный модуль
CMD ["gunicorn", "-b", "0.0.0.0:8000", "wsgi:app"]

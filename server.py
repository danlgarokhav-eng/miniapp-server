import asyncio
from flask import Flask
from telegram.ext import Application, CommandHandler

TELEGRAM_TOKEN = "8824419035:AAG1ixl0eG-VjGD2eiPwWa-XHcHoJbo65ls"

app = Flask(__name__)

@app.route("/")
def home():
    return "Mini App is working!"

async def start(update, context):
    await update.message.reply_text("Открываю мини-приложение...")

def run_bot():
    application = Application.builder().token(TELEGRAM_TOKEN).build()
    application.add_handler(CommandHandler("start", start))

    loop = asyncio.get_event_loop()
    loop.create_task(application.run_polling())
    return loop

if __name__ == "__main__":
    loop = run_bot()
    app.run(host="0.0.0.0", port=5000)

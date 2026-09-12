import asyncio
from flask import Flask
from telegram.ext import Application, CommandHandler
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo

TELEGRAM_TOKEN = "8824419035:AAG1ixl0eG-VjGD2eiPwWa-XHcHoJbo65ls"  # вставь свой токен

# ------------------ FLASK ------------------

app = Flask(__name__)

@app.route("/")
def home():
    return "Mini App is working!"


# ------------------ TELEGRAM BOT ------------------

async def start(update, context):
    keyboard = [
        [
            InlineKeyboardButton(
                text="Открыть магазин",
                web_app=WebAppInfo(url="https://miniapp-server-production.up.railway.app")
            )
        ]
    ]

    reply_markup = InlineKeyboardMarkup(keyboard)
    await update.message.reply_text("Открываю мини‑приложение…", reply_markup=reply_markup)


async def run_bot():
    application = Application.builder().token(TELEGRAM_TOKEN).build()
    application.add_handler(CommandHandler("start", start))
    await application.run_polling()


# ------------------ RUN BOTH ------------------

if __name__ == "__main__":
    loop = asyncio.new_event_loop()      # ← ВАЖНО
    asyncio.set_event_loop(loop)         # ← ВАЖНО
    loop.create_task(run_bot())
    app.run(host="0.0.0.0", port=5000)


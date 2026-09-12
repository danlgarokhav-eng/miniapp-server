import asyncio
from telegram.ext import Application, CommandHandler
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo

TELEGRAM_TOKEN = "8824419035:AAG1ixl0eG-VjGD2eiPwWa-XHcHoJbo65ls"

async def start(update, context):
    keyboard = [
        [
            InlineKeyboardButton(
                text="Открыть магазин",
                web_app=WebAppInfo(url="https://miniapp-server-production.up.railway.app")
            )
        ]
    ]
    await update.message.reply_text(
        "Открываю мини‑приложение…",
        reply_markup=InlineKeyboardMarkup(keyboard)
    )

async def main():
    app = Application.builder().token(TELEGRAM_TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    await app.run_polling()

if __name__ == "__main__":
    asyncio.run(main())

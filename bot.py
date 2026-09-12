import logging
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo, Update, InputFile
from telegram.ext import Application, CommandHandler, ContextTypes, MessageHandler, filters

# ====== ЛОГИ ======
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ====== ТОКЕН ======
TOKEN = "8824419035:AAG1ixl0eG-VjGD2eiPwWa-XHcHoJbo65ls"

# ====== /start ======
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id

    # Фото (можешь заменить на свой URL или файл)
    photo_url = "https://i.imgur.com/7yZ8F8R.jpeg"

    # Кнопка Mini App
    keyboard = [
        [
            InlineKeyboardButton(
                text="🛒 Открыть магазин",
                web_app=WebAppInfo(url="https://miniapp-server-production.up.railway.app")
            )
        ]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)

    # Отправляем фото
    await context.bot.send_photo(
        chat_id=chat_id,
        photo=photo_url,
        caption="👋 *Привет!* Добро пожаловать в наш Telegram Shop!\n\n"
                "🎁 Здесь ты можешь посмотреть товары, добавить в корзину и оформить заказ.\n"
                "👇 Жми кнопку ниже, чтобы открыть магазин!",
        parse_mode="Markdown",
        reply_markup=reply_markup
    )

# ====== Обработчик данных из Mini App ======
async def webapp_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    data = update.effective_message.web_app_data.data
    await update.message.reply_text(f"📩 Получено из Mini App:\n`{data}`", parse_mode="Markdown")

# ====== ЗАПУСК ======
def main():
    app = Application.builder().token(TOKEN).build()

    app.add_handler(CommandHandler("start", start))
    app.add_handler(MessageHandler(filters.StatusUpdate.WEB_APP_DATA, webapp_handler))

    app.run_polling()

if __name__ == "__main__":
    main()


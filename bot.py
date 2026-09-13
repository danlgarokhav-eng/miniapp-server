import telebot
from telebot.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo

BOT_TOKEN = "8824419035:AAG1ixl0eG-VjGD2eiPwWa-XHcHoJbo65ls"
MINIAPP_URL = "https://miniapp-server-production-9b9e.up.railway.app/miniapp"

bot = telebot.TeleBot(BOT_TOKEN)

# Команда /start — только открывает Mini App
@bot.message_handler(commands=['start'])
def start(message):
    markup = InlineKeyboardMarkup()
    btn = InlineKeyboardButton(
        text="🛍 Открыть магазин",
        web_app=WebAppInfo(url=MINIAPP_URL)
    )
    markup.add(btn)

    bot.send_message(
        message.chat.id,
        "Добро пожаловать! Нажми кнопку ниже, чтобы открыть магазин 👇",
        reply_markup=markup
    )

# Запуск бота
bot.polling(none_stop=True)

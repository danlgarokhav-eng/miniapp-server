import time
import requests
import telebot

BOT_TOKEN = "8824419035:AAG1ixl0eG-VjGD2eiPwWa-XHcHoJbo65ls"
CHAT_ID = "5052523892"

API_URL = "https://miniapp-server-production-9b9e.up.railway.app/api/feed"
MINIAPP_URL = "https://miniapp-server-production-9b9e.up.railway.app/miniapp"

bot = telebot.TeleBot(BOT_TOKEN)

# Команда /start
@bot.message_handler(commands=['start'])
def start(message):
    markup = telebot.types.InlineKeyboardMarkup()
    btn = telebot.types.InlineKeyboardButton(
        text="🛍 Открыть магазин",
        url=MINIAPP_URL
    )
    markup.add(btn)

    bot.send_message(
        message.chat.id,
        "Добро пожаловать! Нажми кнопку ниже, чтобы открыть магазин 👇",
        reply_markup=markup
    )

# Функция проверки обновлений
def format_feed(feed):
    if not feed:
        return "❗ Пока нет новых товаров."

    text = "🛍 Новые товары:\n\n"
    for item in feed:
        title = item.get("title", "Без названия")
        price = item.get("price", "—")
        text += f"🔹 <b>{title}</b>\n💰 Цена: {price}\n\n"

    return text

def check_updates():
    while True:
        try:
            feed = requests.get(API_URL).json()
            message = format_feed(feed)
            bot.send_message(CHAT_ID, message, parse_mode="HTML")
        except Exception as e:
            print("Ошибка:", e)

        time.sleep(600)

# Запуск бота
bot.polling(none_stop=True)

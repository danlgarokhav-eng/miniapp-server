import time
import requests
import telebot

BOT_TOKEN = "8824419035:AAG1ixl0eG-VjGD2eiPwWa-XHcHoJbo65ls"
CHAT_ID = "5052523892"

bot = telebot.TeleBot(BOT_TOKEN)

def check_updates():
    while True:
        try:
            feed = requests.get("https://miniapp-server-production-9b9e.up.railway.app/api/feed").json()
            bot.send_message(CHAT_ID, f"Новые товары:\n{feed}")
        except Exception as e:
            print("Ошибка:", e)

        time.sleep(600)  # 10 минут

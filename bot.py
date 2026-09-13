import time
import requests
import telebot

BOT_TOKEN = "ТОКЕН_ТВОЕГО_БОТА"
CHAT_ID = "ТВОЙ_CHAT_ID"

bot = telebot.TeleBot(BOT_TOKEN)

def check_updates():
    while True:
        try:
            feed = requests.get("https://ТВОЙ_ДОМЕН/api/feed").json()
            bot.send_message(CHAT_ID, f"Новые товары:\n{feed}")
        except Exception as e:
            print("Ошибка:", e)

        time.sleep(600)  # 10 минут

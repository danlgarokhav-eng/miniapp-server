import time

# временное хранилище
FEED = []

def update_feed(new_items):
    global FEED
    FEED = new_items

def get_feed():
    return FEED

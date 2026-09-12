from wb_client import get_wb_dresses
from ozon_client import get_ozon_dresses

def get_feed():
    wb = get_wb_dresses(50)
    oz = get_ozon_dresses(50)
    return wb + oz

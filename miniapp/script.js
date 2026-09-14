let feed = [];
let index = 0;

async function loadFeed() {
  try {
    const res = await fetch('/api/feed');
    feed = await res.json();
    if (!Array.isArray(feed)) feed = [];
  } catch (e) {
    feed = [];
  }
  index = 0;
  render();
}

function render() {
  const card = document.getElementById('card');

  if (!feed.length) {
    card.innerHTML = '<div>Нет товаров</div>';
    return;
  }

  const item = feed[index];

  const title = item.title || 'Без названия';
  const brand = item.brand || '';
  const price = item.price ? item.price + ' ₽' : '';
  const image = item.image || '';
  const video = item.video || '';

  let mediaHtml = '';

  if (video) {
    mediaHtml = `<video src="${video}" controls autoplay muted loop></video>`;
  } else if (image) {
    mediaHtml = `<img src="${image}" alt="">`;
  } else {
    mediaHtml = `<div>Нет медиа</div>`;
  }

  card.innerHTML = `
    <div class="media">${mediaHtml}</div>
    <div class="title">${title}</div>
    <div class="brand">${brand}</div>
    <div class="price">${price}</div>
  `;
}

function next() {
  if (index < feed.length - 1) {
    index++;
    render();
  }
}

function prev() {
  if (index > 0) {
    index--;
    render();
  }
}

loadFeed();

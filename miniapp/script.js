async function loadFeed() {
    const feedEl = document.getElementById('feed');

    try {
        const res = await fetch('/api/feed');
        const data = await res.json();

        if (!data || data.length === 0) {
            feedEl.innerText = 'Пока нет товаров.';
            return;
        }

        feedEl.innerHTML = '';

        data.forEach(item => {
            const div = document.createElement('div');
            div.style.marginBottom = '12px';

            const title = document.createElement('div');
            title.textContent = item.title || 'Без названия';

            const price = document.createElement('div');
            price.textContent = item.price || '—';

            div.appendChild(title);
            div.appendChild(price);
            feedEl.appendChild(div);
        });
    } catch (e) {
        feedEl.innerText = 'Ошибка загрузки товаров.';
        console.error(e);
    }
}

loadFeed();

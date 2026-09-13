async function loadFeed() {
    const feedEl = document.getElementById('feed');

    try {
        // ВАЖНО: полный URL, иначе WebView не даст доступ
        const res = await fetch('https://miniapp-server-production-9b9e.up.railway.app/api/feed', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const data = await res.json();

        if (!data || data.length === 0) {
            feedEl.innerText = 'Пока нет товаров.';
            return;
        }

        feedEl.innerHTML = '';

        data.forEach(item => {
            const div = document.createElement('div');
            div.style.marginBottom = '12px';
            div.style.padding = '10px';
            div.style.border = '1px solid #ddd';
            div.style.borderRadius = '8px';
            div.style.background = '#fafafa';

            const title = document.createElement('div');
            title.textContent = item.title || 'Без названия';
            title.style.fontWeight = 'bold';
            title.style.marginBottom = '4px';

            const price = document.createElement('div');
            price.textContent = item.price || '—';

            div.appendChild(title);
            div.appendChild(price);
            feedEl.appendChild(div);
        });
    } catch (e) {
        feedEl.innerText = 'Ошибка загрузки.';
        console.error('Ошибка Mini App:', e);
    }
}

loadFeed();

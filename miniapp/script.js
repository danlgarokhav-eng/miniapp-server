async function loadFeed() {
    const feedEl = document.getElementById('feed');

    try {
        const res = await fetch('https://miniapp-server-production-9b9e.up.railway.app/api/feed');
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

            const title = document.createElement('div');
            title.textContent = item.title;
            title.style.fontWeight = 'bold';

            const price = document.createElement('div');
            price.textContent = item.price;

            div.appendChild(title);
            div.appendChild(price);
            feedEl.appendChild(div);
        });
    } catch (e) {
        feedEl.innerText = 'Ошибка загрузки.';
        console.error(e);
    }
}

loadFeed();


loadFeed();

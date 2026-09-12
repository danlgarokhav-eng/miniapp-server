async function loadFeed() {
    let items = [];

    try {
        const r = await fetch("/api/feed");
        items = await r.json();
    } catch (e) {
        console.error("Ошибка API:", e);
        return;
    }

    const feed = document.getElementById("feed");

    items.forEach(item => {
        if (!item.image) return;

        const div = document.createElement("div");
        div.className = "item";

        div.innerHTML = `
            <img src="${item.image}" onerror="this.style.display='none'">
            <div class="title">${item.title}</div>
            <div class="price">${item.price} ₽</div>
        `;

        feed.appendChild(div);
    });
}

loadFeed();

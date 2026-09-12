async function loadFeed() {
    const r = await fetch("/api/feed");
    const items = await r.json();

    const feed = document.getElementById("feed");

    items.forEach(item => {
        const div = document.createElement("div");
        div.className = "item";

        div.innerHTML = `
            <img src="${item.image}">
            <div class="title">${item.title}</div>
            <div class="price">${item.price} ₽</div>
        `;

        feed.appendChild(div);
    });
}

loadFeed();

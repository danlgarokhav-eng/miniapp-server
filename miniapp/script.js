async function loadFeed() {
    const res = await fetch("https://miniapp-server-production-9b9e.up.railway.app/api/feed");
    const data = await res.json();

    const feedDiv = document.getElementById("feed");
    feedDiv.innerHTML = "";

    data.forEach(item => {
        feedDiv.innerHTML += `<p>${item.title} — ${item.price}</p>`;
    });
}

loadFeed();

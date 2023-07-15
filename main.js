let tryPlayInterval = setInterval(tryPlay, 1000);

function tryPlay() {
    let player = document.querySelector("audio");
    console.log("Trying to start music...");
    player.play()
        .then(() => {
            console.log("Music started.");
            clearInterval(tryPlayInterval);
        })
        .catch(() => {});
}

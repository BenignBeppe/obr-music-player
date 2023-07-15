function tryPlay() {
    console.log("Trying to start music...");
    player.play()
        .then(() => {
            console.log("Music started.");
            clearInterval(tryPlayInterval);
        })
        .catch(() => {});
}

let player = document.querySelector("audio");
let tryPlayInterval = setInterval(tryPlay, 1000);

let audioUrlField = document.querySelector("#audio-url");
audioUrlField.addEventListener("change", () => {
    player.setAttribute("src", audioUrlField.value);
    player.play();
});

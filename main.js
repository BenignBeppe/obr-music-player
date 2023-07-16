import OBR from "@owlbear-rodeo/sdk";

function log(...message) {
    console.log(`${getPluginId()}:`, ...message);
}

function getPluginId(path) {
    return path ? `eu.sebber.music-player/${path}` : "eu.sebber.music-player";
}

function tryPlay() {
    log("Trying to start music...");
    player.play()
        .then(() => {
            log("Music started.");
            clearInterval(tryPlayInterval);
        })
        .catch(() => {});
}

function playTrack(url) {
    player.setAttribute("src", url);
    player.play();
}

async function init() {
    let metadata = await OBR.scene.getMetadata();
    let trackUrl = metadata[getPluginId("trackUrl")];
    player.setAttribute("src", trackUrl);
    tryPlayInterval = setInterval(tryPlay, 1000);
    OBR.scene.onMetadataChange((metadata) => {
        let newTrackUrl = metadata[getPluginId("trackUrl")];
        if(newTrackUrl !== trackUrl) {
            trackUrl = playTrack(newTrackUrl);
        }
    });
}

let player = document.querySelector("audio");
let tryPlayInterval = null;

let audioUrlField = document.querySelector("#audio-url");
audioUrlField.addEventListener("change", async () => {
    let audioUrl = audioUrlField.value;
    OBR.scene.setMetadata({
        [getPluginId("trackUrl")]: audioUrl
    });
});

OBR.onReady(async () => {
    if(OBR.scene.isReady()) {
        try {
            await init();
        } catch {
            // TODO: figure out a better solution to error "No scene
            // found" when isReady() returns true.
            setTimeout(init, 5000);
        }
    } else {
        OBR.scene.onReadyChange((ready) => {
            if(ready) {
                init();
            }
        });
    }
});

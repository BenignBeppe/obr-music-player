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
        })
        .catch(() => {
            log(`Failed to start music. Retrying in ${retryDelay / 1000} seconds.`);
            setTimeout(tryPlay, retryDelay);
        });
}

async function init() {
    let metadata = await OBR.scene.getMetadata();
    let currentTrackUrl = metadata[getPluginId("trackUrl")];
    player.setAttribute("src", currentTrackUrl);
    let settings = getSettings();
    setVolume(settings.maxVolume, settings.volume);
    maxVolumeInput.value = settings.maxVolume;
    volumeInput.value = settings.volume;
    player.muted = !settings.soundOn;

    if(currentTrackUrl) {
        tryPlay();
    }
    
    OBR.scene.onMetadataChange((metadata) => {
        let trackUrl = metadata[getPluginId("trackUrl")];
        if(trackUrl === currentTrackUrl) {
            return;
        }

        // TODO: Fix warning when the url is empty.
        player.setAttribute("src", trackUrl);
        if(trackUrl) {
            player.play();
        }
        currentTrackUrl = trackUrl;
        updateTrackList();
    });
    updateTrackList();
}

function getSettings() {
    return JSON.parse(localStorage.getItem(getPluginId())) || defaultSettings;
}

async function updateTrackList() {
    let metadata = await OBR.scene.getMetadata();
    let tracks = metadata[getPluginId("tracks")];
    if(!tracks) {
        return;
    }

    let trackElements = [];
    let playingTrackUrl = metadata[getPluginId("trackUrl")];
    let playingIndex = tracks.findIndex(t => t.url === playingTrackUrl);
    for(let [index, track] of tracks.entries()) {
        let template = document.querySelector("#templates .track");
        let element = template.cloneNode(true);
        let label = element.querySelector(".label");
        label.textContent = track.name;
        label.setAttribute("title", track.name);
        let playButton = element.querySelector(".play-track");
        playButton.addEventListener("click", () => {changeTrack(track);});
        let showMenuButton = element.querySelector(".show-menu");
        let menu = element.querySelector(".menu");
        showMenuButton.addEventListener(
            "click",
            () => menu.hidden = !menu.hidden
        );
        let editNameButton = element.querySelector(".edit-name");
        editNameButton.addEventListener(
            "click",
            () => { editTrackName(track); }
        );
        let editUrlButton = element.querySelector(".edit-url");
        editUrlButton.addEventListener(
            "click",
            () => { editTrackUrl(track); }
        );
        let removeTrackButton = element.querySelector(".remove");
        removeTrackButton.addEventListener("click", removeTrack);
        if(index === playingIndex) {
            element.classList.add("playing");
        }

        trackElements.push(element);
    }
    let trackList = document.querySelector("#track-list");
    trackList.replaceChildren(...trackElements);
}

async function changeTrack(track) {
    await OBR.scene.setMetadata({
        [getPluginId("trackUrl")]: track ? track.url : "",
        [getPluginId("startTime")]: Date.now()
    });
}

async function editTrackName(track) {
    let name = prompt("Enter name of track:", track.name);
    if(!name || name === track.name) {
        return;
    }

    let tracks = (await OBR.scene.getMetadata())[getPluginId("tracks")];
    // Rename the track with matching URL.
    tracks.forEach(t => {
        if(t.url === track.url) {
            t.name = name;
        }
    });
    await OBR.scene.setMetadata({
        [getPluginId("tracks")]: tracks
    });
    log(`Changed track name "${track.name}" => "${name}".`);
    updateTrackList();
}

async function editTrackUrl(track) {
    let url = prompt("Enter URL to audio file:", track.url);
    if(!url || url === track.url) {
        return;
    }

    let metadata = await OBR.scene.getMetadata();
    let tracks = metadata[getPluginId("tracks")] || [];
    let matchingUrlTrack = tracks.find(t => t.url === url);
    if(matchingUrlTrack) {
        alert(
            "A track with that URL is already in the list: " +
            `"${matchingUrlTrack.name}". URL will not be changed.`
        );
        return;
    }

    // Rename the track with matching URL.
    tracks.forEach(t => {
        if(t.url === track.url) {
            t.url = url;
        }
    });
    await OBR.scene.setMetadata({
        [getPluginId("tracks")]: tracks
    });
    log(`Changed track URL "${track.url}" => "${url}".`);
    updateTrackList();
}

async function removeTrack(event) {
    let trackElement = event.target.closest(".track");
    let trackElements = Array.from(document.querySelectorAll("#track-list .track"));
    let index = trackElements.indexOf(trackElement);
    let metadata = await OBR.scene.getMetadata();
    let tracks = metadata[getPluginId("tracks")];
    let track = tracks[index];
    let confirmed = confirm(`Are you sure you want to remove track "${track.name}" from the list?`);
    if(!confirmed) {
        return;
    }

    tracks.splice(index, 1);
    let currentTrackUrl = metadata[getPluginId("trackUrl")];
    if(track.url === currentTrackUrl) {
        changeTrack(null);
    }
    await OBR.scene.setMetadata({
        [getPluginId("tracks")]: tracks
    });
    log(`Removed track "${track.name}" with URL ${track.url}.`);
    updateTrackList();
}

function setVolume(maxVolume, volume) {
    player.volume = maxVolume * volume;
}


/**
 * Converts a URL into a suggested track name.
 *
 * @param {string} url
 * @return {string}
 */
function makeSuggestedName(url) {
    // Take the end bit of the path (after last slash).
    let pathEnd = url.split("/").at(-1);
    // Remove any file ending.
    let fileName = pathEnd.split(".")[0];
    // Replace space stand ins with actual spaces.
    let name = fileName.replace(/[_+-]/g, " ");

    return name;
}

async function syncPosition() {
    let metadata = await OBR.scene.getMetadata();
    let startTime = metadata[getPluginId("startTime")];
    let timePlayed = (Date.now() - startTime) / 1000.0;
    player.currentTime = timePlayed % player.duration;
}

let retryDelay = 1000;
let defaultSettings = {
    maxVolume: 0.1,
    volume: 0.5,
    soundOn: false
};
let player = document.querySelector("audio");
let toggleSoundButton = document.querySelector("#sound-toggle");
player.addEventListener("volumechange", () => {
    if(player.muted) {
        toggleSoundButton.classList.add("sound-off");
        toggleSoundButton.classList.remove("sound-on");
    } else {
        toggleSoundButton.classList.add("sound-on");
        toggleSoundButton.classList.remove("sound-off");
    }
});
// Do this on "durationchange" because the duration is not available on
// "play" event.
player.addEventListener("durationchange", syncPosition);

toggleSoundButton.addEventListener("click", () => {
    player.muted = !player.muted;
    let settings = getSettings();
    settings.soundOn = !player.muted;
    localStorage.setItem(getPluginId(), JSON.stringify(settings));
});
let addTrackButton = document.querySelector("#add-track");
addTrackButton.addEventListener("click", async () => {
    let url = prompt("Enter URL to audio file:");
    if(!url) {
        return;
    }

    let metadata = await OBR.scene.getMetadata();
    let tracks = metadata[getPluginId("tracks")] || [];
    let matchingUrlTrack = tracks.find(t => t.url === url);
    if(matchingUrlTrack) {
        alert(
            "A track with that URL is already in the list: " +
            `"${matchingUrlTrack.name}". New track will not be added.`
        );
        return;
    }

    let suggestedName = makeSuggestedName(url);
    let name = prompt("Enter name of track:", suggestedName);
    if(!name) {
        return;
    }

    tracks.push({
        name: name,
        url: url
    });
    await OBR.scene.setMetadata({
        [getPluginId("tracks")]: tracks
    });
    log(`Added track "${name}" with URL ${url}.`);
    updateTrackList();
});

let showSettingsButton = document.querySelector("#show-settings");
let settingsPanel = document.querySelector("#settings-panel");
showSettingsButton.addEventListener("click", () => {
    settingsPanel.hidden = !settingsPanel.hidden;
});

let volumeInput = document.querySelector("#volume");
let maxVolumeInput = document.querySelector("#max-volume");
for(let volumeControl of [volumeInput, maxVolumeInput]) {
    volumeControl.addEventListener("change", () => {
        let maxVolume = maxVolumeInput.value;
        let volume = volumeInput.value;
        setVolume(maxVolume, volume);

        let settings = getSettings();
        settings.maxVolume = maxVolume;
        settings.volume = volume;
        localStorage.setItem(getPluginId(), JSON.stringify(settings));
    });
}

OBR.onReady(async () => {
    if(await OBR.scene.isReady()) {
        init();
    } else {
        OBR.scene.onReadyChange((ready) => {
            if(ready) {
                init();
            }
        });
    }
});

import AddRounded from "@mui/icons-material/AddRounded";
import EditRounded from "@mui/icons-material/EditRounded";
import LinkRounded from "@mui/icons-material/LinkRounded";
import PlayArrowRounded from "@mui/icons-material/PlayArrowRounded";
import VolumeOffRounded from "@mui/icons-material/VolumeOffRounded";
import VolumeUpRounded from "@mui/icons-material/VolumeUpRounded";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import Slider from "@mui/material/Slider";
import Stack from "@mui/material/Stack";
import OBR, { type Metadata } from "@owlbear-rodeo/sdk";
import { useEffect, useRef, useState } from "react";
import { PluginListItem } from "../lib/obr-plugin/PluginListItem.tsx";

const defaultSettings = {
    volume: 0.5,
    soundOn: true
};

interface Track {
    name: string;
    url: string;
}

export function App() {
    let [currentTrackUrl, setCurrentTrackUrl] = useState("");
    let [soundOn, setSoundOn] = useState(getSettings().soundOn);
    let [volume, setVolume] = useState(getSettings().volume);

    useEffect(() => {
        function handleTrackUrlChange(metadata: Metadata) {
            let url = metadata[getPluginId("trackUrl")] as string;
            setCurrentTrackUrl(url);
        };
        OBR.room.getMetadata().then(handleTrackUrlChange);
        return OBR.room.onMetadataChange(handleTrackUrlChange);
    }, []);

    return <Stack>
        <Stack direction="row" sx={{ alignItems: "center" }}>
            <Player trackUrl={currentTrackUrl} />
            <SoundOn soundOn={soundOn} setSoundOn={setSoundOn} />
            <Volume volume={volume} setVolume={setVolume} />
            <AddTrack />
        </Stack>
        <Divider variant="middle" />
        <TrackList currentTrackUrl={currentTrackUrl} />
    </Stack>;
}

function Player({trackUrl}: {trackUrl: string}) {
    let settings = getSettings();
    let ref = useRef<HTMLAudioElement>(null);
    let [blocked, setBlocked] = useState(false);

    async function syncPosition() {
        if(!ref.current) {
            return;
        }

        if(!ref.current.duration) {
            return;
        }

        let metadata = await OBR.room.getMetadata();
        let startTime = metadata[getPluginId("startTime")] as number;
        let timePlayed = (Date.now() - startTime) / 1000.0;
        if(timePlayed > 1) {
            // Don't sync if we just started playing. This will skip a split
            // second and miss up the intro.
            // TODO: Fix this in a more elegant way.
            ref.current.currentTime = timePlayed % ref.current.duration;
        }
    }

    useEffect(() => {
        if(blocked) {
            return;
        }

        ref.current?.play()
            .then(syncPosition)
            .catch(
                (error) => {
                    if(error.name === "NotAllowedError" && !ref.current?.muted) {
                        // Autoplay was blocked.
                        setBlocked(true);
                        OBR.notification.show("Autoplay is blocked. Click the play button or allow autoplaying audio to start music.", "WARNING")
                    }
                }
            );
    }, [blocked]);

    useEffect(() => {
        if(!ref.current) {
            return;
        }

        ref.current.muted = !settings.soundOn;
    }, [settings.soundOn]);

    useEffect(() => {
        if(!ref.current) {
            return;
        }

        // Ease in the actual volume to make it easier to set low volumes.
        ref.current.volume = Math.pow(settings.volume, 3);
    }, [settings.volume]);

    return <>
        {blocked && <IconButton>
            <PlayArrowRounded onClick={() => setBlocked(false)}/>
        </IconButton>}
        <audio ref={ref} loop autoPlay src={trackUrl} onPlay={syncPosition} />
    </>;
}

function SoundOn(
    {soundOn, setSoundOn}:
    {soundOn: boolean, setSoundOn: (value: boolean) => void}
) {
    function onClick() {
        let settings = getSettings();
        let newSoundOn = !settings.soundOn;
        setSoundOn(newSoundOn);
        settings.soundOn = newSoundOn;
        localStorage.setItem(getPluginId(), JSON.stringify(settings));
    }

    return <IconButton title="Toggle sound" onClick={onClick}>
        {soundOn ? <VolumeUpRounded /> : <VolumeOffRounded />}
    </IconButton>;
}

function Volume(
    {volume, setVolume}:
    {volume: number, setVolume: (value: number) => void}
) {
    function onChange(_event: Event, newVolume: number) {
        setVolume(newVolume);
        let settings = getSettings();
        settings.volume = newVolume;
        localStorage.setItem(getPluginId(), JSON.stringify(settings));
    }

    return <Slider
        min={0}
        max={1}
        step={0.001}
        value={volume}
        onChange={onChange}
        sx={{marginInline: 2}}
    />;
}

function AddTrack() {
    async function addTrack() {
        let url = prompt("Enter URL to audio file:");
        if(!url) {
            return;
        }

        let metadata = await OBR.room.getMetadata();
        let tracks = metadata[getPluginId("tracks")] as Track[] || [];
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
        await OBR.room.setMetadata({
            [getPluginId("tracks")]: tracks
        });
    }

    /**
     * Convert a URL into a suggested track name.
     *
     * @param {string} url
     * @return {string}
     */
    function makeSuggestedName(url: string): string {
        // Take the end bit of the path (after last slash).
        let pathEnd = url.split("/").at(-1) as string;
        // Remove any file ending.
        let fileName = pathEnd.split(".")[0];
        // Replace space stand ins with actual spaces.
        let name = fileName.replace(/[_+-]/g, " ");

        return name;
    }

    return <IconButton onClick={addTrack}>
        <AddRounded />
    </IconButton>;
}

function TrackList({currentTrackUrl}: {currentTrackUrl: string}) {
    let [tracks, setTracks] = useState<Track[]>([]);
    useEffect(() => {
        function handleMetadataChange(metadata: Metadata) {
            let tracks = metadata[getPluginId("tracks")] as Track[];
            setTracks(tracks);
        };
        OBR.room.getMetadata().then(handleMetadataChange);
        return OBR.room.onMetadataChange(handleMetadataChange);
    }, []);

    return <List >
        {tracks?.map((track, index) => (
            <TrackItem
                key={track.url}
                tracks={tracks}
                index={index}
                track={track}
                currentTrackUrl={currentTrackUrl}
            />
        ))}
    </List>;
}

function TrackItem({track, tracks, index, currentTrackUrl}:
    {track: Track, tracks: Track[], index: number, currentTrackUrl: string}
) {
    let playTrack = <PlayTrack track={track} currentTrackUrl={currentTrackUrl} />;

    let buttons = [
        <EditTrackName track={track} />,
        <EditTrackUrl track={track} />
    ];
    let labelProps = {
        color: currentTrackUrl === track.url ? "primary" : "textPrimary"
    };

    async function removeTrack() {
        let metadata = await OBR.room.getMetadata();
        let tracks = metadata[getPluginId("tracks")] as Track[];
        let confirmed = confirm(`Are you sure you want to remove track "${track.name}" from the list?`);
        if(!confirmed) {
            return;
        }

        let index = tracks.findIndex((t) => t.url === track.url);
        tracks.splice(index, 1);
        await OBR.room.setMetadata({
            [getPluginId("tracks")]: tracks
        });
        log(`Removed track "${track.name}" with URL ${track.url}.`);
    }

    async function moveTrack(track: Track, shift: number) {
        let metadata = await OBR.room.getMetadata();
        let tracks = metadata[getPluginId("tracks")] as Track[];
        let index = tracks.findIndex((t) => t.url === track.url);
        if(index === -1) {
            // Couldn't find track.
            return;
        }

        let adjacentIndex = index + shift;
        if(adjacentIndex < 0 || adjacentIndex > tracks.length - 1) {
            // Adjacent index out of list.
            return;
        }

        // Swap track with the one above.
        [tracks[adjacentIndex], tracks[index]] = [tracks[index], tracks[adjacentIndex]];
        await OBR.room.setMetadata({
            [getPluginId("tracks")]: tracks
        });
    }

    return <PluginListItem
        key={track.url}
        index={index}
        item={track}
        label={track.name}
        labelProps={labelProps}
        items={tracks}
        actionButton={playTrack}
        buttons={buttons}
        moveItem={moveTrack}
        removeItem={removeTrack}
    />;
}

function PlayTrack({track, currentTrackUrl}:
    {track: Track, currentTrackUrl: string}
) {
    async function playTrack() {
        await OBR.room.setMetadata({
            [getPluginId("trackUrl")]: track.url,
            [getPluginId("startTime")]: Date.now()
        });
    }

    function isPlayingTrack(): boolean {
        return currentTrackUrl === track.url;
    }

    return <IconButton
        title="Play"
        onClick={playTrack}
        {...isPlayingTrack() && {color: "primary"}}
    >
        <PlayArrowRounded />
    </IconButton>;
}

function EditTrackName({track}: {track: Track}) {
    async function editTrackName() {
        let name = prompt("Enter name of track:", track.name);
        if(!name || name === track.name) {
            return;
        }

        let tracks = (await OBR.room.getMetadata())[getPluginId("tracks")] as Track[];
        // Rename the track with matching URL.
        tracks.forEach(t => {
            if(t.url === track.url) {
                t.name = name;
            }
        });
        await OBR.room.setMetadata({
            [getPluginId("tracks")]: tracks
        });
        log(`Changed track name "${track.name}" => "${name}".`);
    }

    return <IconButton title="Edit name" onClick={editTrackName}>
        <EditRounded />
    </IconButton>;
}

function EditTrackUrl({track}: {track: Track}) {
    async function editTrackUrl() {
        let url = prompt("Enter URL to audio file:", track.url);
        if(!url || url === track.url) {
            return;
        }

        let metadata = await OBR.room.getMetadata();
        let tracks = metadata[getPluginId("tracks")] as Track[] || [];
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
        await OBR.room.setMetadata({
            [getPluginId("tracks")]: tracks
        });
        log(`Changed track URL "${track.url}" => "${url}".`);
    }

    return <IconButton title="Edit URL" onClick={editTrackUrl}>
        <LinkRounded />
    </IconButton>
}

function getPluginId(path?: string): string {
    return path ? `eu.sebber.music-player/${path}` : "eu.sebber.music-player";
}

function log(...message: string[]) {
    console.log(`${getPluginId()}:`, ...message);
}

function getSettings() {
    let settingsString = localStorage.getItem(getPluginId());
    if(!settingsString) {
        return defaultSettings;
    }
    return JSON.parse(settingsString);
}

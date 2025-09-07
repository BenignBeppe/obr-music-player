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
import { type RefObject, useEffect, useRef, useState } from "react";
import { PluginListItem } from "../lib/obr-plugin/PluginListItem.tsx";

const defaultSettings = {
    volume: 0.5,
    soundOn: true
};

interface Track {
    name: string,
    url: string
}

export function App() {
    let [playingUrl, setPlayingUrl] = useState<string>("");
    useEffect(() => {
        function handleTrackUrlChange(metadata: Metadata) {
            let url = metadata[getPluginId("trackUrl")] as string;
            setPlayingUrl(url);
        };
        OBR.room.getMetadata().then(handleTrackUrlChange);
        return OBR.room.onMetadataChange(handleTrackUrlChange);
    }, []);

    let audioRef = useRef(null);

    return <Stack>
        <Player trackUrl={playingUrl} audioRef={audioRef} />
        <Stack direction="row" sx={{ alignItems: "center" }}>
            <SoundOnToggle audioRef={audioRef} />
            <Volume audioRef={audioRef} />
            <IconButton onClick={addTrack}>
                <AddRounded />
            </IconButton>
        </Stack>
        <Divider variant="middle" />
        <TrackList playingUrl={playingUrl} />
    </Stack>;
}

function Player({trackUrl, audioRef}: {trackUrl: string, audioRef: RefObject<HTMLAudioElement | null>}) {
    async function syncPosition() {
        let metadata = await OBR.room.getMetadata();
        let startTime = metadata[getPluginId("startTime")] as number;
        let timePlayed = (Date.now() - startTime) / 1000.0;
        if(timePlayed > 1) {
            // Don't sync if we just started playing. This will skip a split
            // second and miss up the intro.
            // TODO: Fix this in a more elegant way.
            audio.currentTime = timePlayed % audio.duration;
        }
    }

    let audio = audioRef.current as HTMLAudioElement;
    if(audio) {
        let settings = getSettings();
        audio.volume = makeAdjustedVolume(settings.volume);
        audio.muted = !settings.soundOn;
    }

    return <audio ref={audioRef} loop autoPlay src={trackUrl} onPlay={syncPosition} />;
}

function SoundOnToggle({audioRef}: {audioRef: RefObject<HTMLAudioElement | null>}) {
    let audio = audioRef.current as HTMLAudioElement;
    let startSettings = getSettings();
    let [soundOn, setSoundOn] = useState(startSettings.soundOn);

    function toggleSoundOn() {
        let soundOn = audio.muted;
        audio.muted = !soundOn;
        setSoundOn(soundOn);
        let settings = getSettings();
        settings.soundOn = soundOn;
        localStorage.setItem(getPluginId(), JSON.stringify(settings));
    }

    return <IconButton title="Toggle sound" onClick={toggleSoundOn}>
        {soundOn ? <VolumeUpRounded /> : <VolumeOffRounded />}
    </IconButton>;
}

function Volume({audioRef}: {audioRef: RefObject<HTMLAudioElement | null>}) {
    let audio = audioRef.current as HTMLAudioElement;
    let startSettings = getSettings();
    let [sliderValue, setSliderValue] = useState(startSettings.volume);

    function onChange(_event: Event, value: number) {
        setSliderValue(value);
        // Ease in the actual volume to make it easier to set low volumes.
        let volume = makeAdjustedVolume(value);
        audio.volume = volume;
        let settings = getSettings();
        settings.volume = value;
        localStorage.setItem(getPluginId(), JSON.stringify(settings));
    }

    return <Slider min={0} max={1} step={0.001} value={sliderValue} onChange={onChange} sx={{marginInline: 2}} />;
}

function TrackList({playingUrl}: {playingUrl: string}) {
    let [tracks, setTracks] = useState<Track[]>([]);
    useEffect(() => {
        function handleTracksChange(metadata: Metadata) {
            let tracks = metadata[getPluginId("tracks")] as Track[];
            setTracks(tracks);
        };
        OBR.room.getMetadata().then(handleTracksChange);
        return OBR.room.onMetadataChange(handleTracksChange);
    }, []);

    return <List >
        {tracks?.map((track, index) => (
            <TrackItem key={track.url} tracks={tracks} index={index} track={track} playingUrl={playingUrl} />
        ))}
    </List>;
}

function TrackItem(
    {track, tracks, index, playingUrl}:
    {track: Track, tracks: Track[], index: number, playingUrl: string}
) {
    async function playTrack() {
        await OBR.room.setMetadata({
            [getPluginId("trackUrl")]: track.url,
            [getPluginId("startTime")]: Date.now()
        });
    }

    function isPlayingTrack(): boolean {
        return playingUrl === track.url;
    }

    let actionButton = <IconButton title="Play" onClick={playTrack} {...isPlayingTrack() && {color: "primary"}}>
            <PlayArrowRounded />
        </IconButton>;

    let buttons = [
        <IconButton title="Edit name" onClick={() => editTrackName(track)}>
            <EditRounded />
        </IconButton>,
        <IconButton title="Edit URL" onClick={() => editTrackUrl(track)}>
            <LinkRounded />
        </IconButton>
    ];
    let labelProps = {
        color: isPlayingTrack() ? "primary" : "textPrimary"
    };

    return <PluginListItem
        key={track.url}
        label={track.name}
        labelProps={labelProps}
        items={tracks}
        index={index}
        item={track}
        actionButton={actionButton}
        buttons={buttons}
        moveItem={moveTrack}
        removeItem={removeTrack}
    />;
}

function getPluginId(path?: string): string {
    return path ? `eu.sebber.music-player/${path}` : "eu.sebber.music-player";
}

function log(...message: string[]) {
    console.log(`${getPluginId()}:`, ...message);
}

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
 * Converts a URL into a suggested track name.
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

function getSettings() {
    let settingsString = localStorage.getItem(getPluginId());
    if(!settingsString) {
        return defaultSettings;
    }
    return JSON.parse(settingsString);
}

function makeAdjustedVolume(value: number): number {
    let volume = Math.pow(value, 3);
    return volume;
}

async function editTrackName(track: Track) {
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

async function editTrackUrl(track: Track) {
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

async function removeTrack(track: Track) {
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

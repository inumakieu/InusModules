import { assert } from 'chai';
import Aniwatch from '../src/aniwatch';
import runner from '@mochiapp/runner';
import { describe, it } from 'mocha'; 

describe("Aniwatch Tests", () => {
    const module = runner(Aniwatch);

    it("fetch search", async () => {
        const f = await module.search({ query: "attack", filters: [] });
        console.log(f.items)
        assert(f.items.length != 0);
    });

    it("fetch info", async () => {
        const f = await module.playlistDetails("classroom-of-the-elite-713");
        console.log(f);
        assert(f != null);
    });

    it("fetch episodes", async () => {
        const f = await module.playlistEpisodes("classroom-of-the-elite-713");
        console.log(f);
        assert(f != null);
    });
});
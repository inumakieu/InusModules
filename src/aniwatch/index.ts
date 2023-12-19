import {
  DiscoverListing,
  Paging,
  Playlist,
  PlaylistDetails,
  PlaylistEpisodeServer,
  PlaylistEpisodeServerFormatType,
  PlaylistEpisodeServerLink,
  PlaylistEpisodeServerQualityType,
  PlaylistEpisodeServerRequest,
  PlaylistEpisodeServerResponse,
  PlaylistEpisodeSource,
  PlaylistEpisodeSourcesRequest,
  PlaylistItem,
  PlaylistItemsOptions,
  PlaylistItemsResponse,
  PlaylistStatus,
  PlaylistType,
  SearchFilter,
  SearchQuery,
  SourceModule,
  VideoContent,
  PlaylistEpisodeServerSubtitleFormat
} from "@mochiapp/js";

import * as cheerio from "cheerio";
import CryptoJS from 'crypto-js';

type JSONResponse = {
  status: Boolean;
  html: string;
  totalItems: number;
  continueWatch: undefined;
}

export default class Aniwatch extends SourceModule implements VideoContent {
  static BASE_URL = "https://aniwatch.to";
  static AJAX_URL = "https://ajax.gogo-load.com/ajax";

  metadata = {
    name: "Aniwatch",
    description: "A module to get data from Aniwatch (formerly Zoro)",
    icon: `${Aniwatch.BASE_URL}/images/favicon.png`,
    version: "0.0.31",
  };

  async searchFilters(): Promise<SearchFilter[]> {
    return [];
    //throw new Error("Method not implemented.");
  }

  async searchFilter(): Promise<SearchFilter[]> {
    return [];
    //throw new Error("Method not implemented.");
  }

  async search(query: SearchQuery): Promise<Paging<Playlist>> {
    const page = query.page ?? "1";
    const filters = query.filters.flatMap((filter) =>
      filter.optionIds.flatMap((id) => `${filter.id}=${id}`)
    )
    .join("&");

    let encodedURI: string;

    if (filters.length > 0) {
      encodedURI = encodeURI(
        `${Aniwatch.BASE_URL}/search?keyword=${query.query}&page=${page}`
      );
    } else {
      encodedURI = encodeURI(
        `${Aniwatch.BASE_URL}/search?keyword=${query.query}&page=${page}`
      );
    }

    const response = await request.get(encodedURI);

    const $ = cheerio.load(response.text());
    return parsePageListing($);
  }

  async discoverListings(): Promise<DiscoverListing[]> {
    return []
  }

  async playlistDetails(id: String): Promise<PlaylistDetails> {
    let html = (
      await request.get(`${Aniwatch.BASE_URL}/${id}`)
    ).text();

    const $ = cheerio.load(html);

    let titles: string[] = [];

    let primary = $(".film-name.dynamic-name").text();
    let secondary = $(".anisc-info > .item.item-title > .name").first().text();

    titles.push(primary);
    titles.push(secondary);

    let poster = $(".film-poster-img").first().attr("src") ?? "";

    let synopsis = $(".item.item-title.w-hide > .text").text().trim();

    let rating: number = 0.0;
    let genres: string[] = [];
    let yearReleased: number = 0.0;
    let synonyms: string = "";

    $(".anisc-info").children(".item.item-title").each((_, element) => {
        const text = $(element).text().trim();
        if (text.includes("MAL Score")) {
          rating = parseFloat($(element).text().replace("MAL Score:", "").trim())
        } else if (text.includes("Premiered")) {
          yearReleased = parseFloat($(element).text().replace("Premiered:", "").trim().split(" ")[1])
        } else if (text.includes("Synonyms")) {
          synonyms = $(element).text().replace("Synonyms:", "").trim()
      }
    });

    $(".anisc-info").children(".item.item-list").each((_, element) => {
      const text = $(element).text().trim();
      if (text.includes("Genres")) {
          genres = $(element).find("a").map((_, el) => $(el).text().trim()).get();
      }
  });
      
    return {
      altBanners: [],
      altPosters: [poster],
      altTitles: [primary, secondary, synonyms].filter((item) => item !== undefined) as string[],
      genres: genres,
      previews: [],
      ratings: rating,
      synopsis: synopsis,
      yearReleased: yearReleased
    }
  }

  async playlistEpisodes(playlistId: string, options?: PlaylistItemsOptions | undefined): Promise<PlaylistItemsResponse> {
    console.log(options);
    const html = (
      await request.get(`${Aniwatch.BASE_URL}/${playlistId}`)
    ).text();
    let $ = cheerio.load(html);

    let ajaxId = $("#wrapper").attr("data-id");
    console.log(ajaxId);

    /*const json = (
      await request.get(`https://aniwatch.to/ajax/v2/episode/list/${ajaxId}`)
    ).json<JSONResponse>();*/

    try {
      const json: JSONResponse = await (
        await request.get(`https://aniwatch.to/ajax/v2/episode/list/${ajaxId}`)
      ).json();

      $ = cheerio.load(json.html);

      let list: PlaylistItem[] = []
      $(".ssl-item.ep-item").map((_, el) => {
        list.push({
          id: "https://aniwatch.to/ajax/v2/episode/servers?episodeId=" + $(el).attr("href")?.split("?ep=")[1],
          title: $(el).attr("title") ?? "",
          number: parseFloat($(el).attr("data-number") ?? ""),
          tags: []
        })
      })

      return [
        {
          id: "",
          number: 1,
          altTitle: "Episodes",
          variants: [
            {
              id: "",
              title: "Sub",
              pagings: [
                {
                  id: "",
                  items: list
                }
              ]
            }
          ]
        }
      ];
    } catch(error) {
      console.log(error)
      return []
    }
  }
  
  async playlistEpisodeSources(req: PlaylistEpisodeSourcesRequest): Promise<PlaylistEpisodeSource[]> {
    console.log(req.episodeId)

    const response = JSON.parse((await request.get(req.episodeId)).text());

    let $ = cheerio.load(response.html);

    let subServers: PlaylistEpisodeServer[] = []
    $(".ps_-block.ps_-block-sub.servers-sub").find(".server-item").each((_, el) =>  {
      if($(el).text().includes("Vidstreaming")) {
        subServers.push(
          {
            displayName: "Vidstreaming",
            id: "https://aniwatch.to/ajax/v2/episode/sources?id=" + $(el).attr("data-id")
          }
        )
      }
    });

    let dubServers: PlaylistEpisodeServer[] = []
    $(".ps_-block.ps_-block-sub.servers-dub").find(".server-item").each((_, el) =>  {
      if($(el).text().includes("Vidstreaming")) {
        dubServers.push(
          {
            displayName: "Vidstreaming",
            id: "https://aniwatch.to/ajax/v2/episode/sources?id=" + $(el).attr("data-id")
          }
        )
      }
    });

    return [
      {
        displayName: "Sub",
        id: "",
        servers: subServers
      },
      {
        displayName: "Dub",
        id: "",
        servers: dubServers
      }
    ]
  }

  async playlistEpisodeServer(req: PlaylistEpisodeServerRequest): Promise<PlaylistEpisodeServerResponse> {
    console.log(req.serverId)

    const link = JSON.parse((await request.get(req.serverId)).text()).link;
    const embedId = link.replace("https://megacloud.tv/embed-2/e-1/", "").split("?")[0];

    const embedUrl = `https://megacloud.tv/embed-2/ajax/e-1/getSources?id=${embedId}`;

    const myJsonObject = JSON.parse((await request.get(embedUrl)).text());

    if(myJsonObject.encrypted == true) {
        const base64 = myJsonObject.sources;
        const enc_key: {key: string} = (await (await request.get("https://zoro.anify.tv/key/6")).json())
        let keyArray = [];

        // Removing the square brackets and splitting the string into individual elements
        const cleanedString = enc_key.key.slice(2, -2); // Removing the first '[[' and last ']]'
        const stringArray = cleanedString.split('],[');

        // Converting the string elements into arrays of numbers
        const resultArray: number[][] = stringArray.map(item => {
          const numbers = item.split(',').map(Number);
          return numbers;
        });

        keyArray = resultArray

        let decryptedKey = "";
        let offset = 0;
        let encryptedString = base64;

        for (const i in keyArray) {
            const start = keyArray[i][0];
            const end = keyArray[i][1];

            decryptedKey += encryptedString.slice(start - offset, end - offset);
  
            encryptedString = encryptedString.slice(0, start - offset) + encryptedString.slice(end - offset);
            offset += end - start;
        }

        console.log("Decrypting")
        console.log(`Decryption Key: ${decryptedKey}`)

        const dec = CryptoJS.AES.decrypt(encryptedString, decryptedKey)
        console.log(dec)
        const decryptedSources = CryptoJS.enc.Utf8.stringify(dec);

        console.log(decryptedSources)

        const manifestUrl = JSON.parse(decryptedSources)[0].file;
        const resResult = (await request.get(manifestUrl)).text();

        let qualities: PlaylistEpisodeServerLink[] = [];
        const resolutions = resResult.split("\\n\\n")[0].match(/(RESOLUTION=)(.*)(\s*?)(\s*.*)/g);
        resolutions?.forEach((res) => {
            const index = manifestUrl.lastIndexOf("/");
            const quality = res.split("\n")[0].split("x")[1].split(",")[0];
            const url = manifestUrl.slice(0, index);
            qualities.push({
                url: url + "/" + res.split("\n")[1].replace("/", ""),
                format: PlaylistEpisodeServerFormatType.hsl,
                quality: quality == "1080" ? PlaylistEpisodeServerQualityType.q1080p : (
                  quality == "720" ? PlaylistEpisodeServerQualityType.q720p : (
                    quality == "480" ? PlaylistEpisodeServerQualityType.q480p : PlaylistEpisodeServerQualityType.q360p
                  )
                ) // this.stringQualityToRealType(quality + "p"),
            });
        });

        qualities.push({ format: PlaylistEpisodeServerFormatType.hsl, url: manifestUrl, quality: PlaylistEpisodeServerQualityType.auto });

        const uniqueAuthors = qualities.reduce((accumulator, current) => {
            if (!accumulator.find((item) => item.quality === current.quality)) {
                accumulator.push(current);
            }
            return accumulator;
        }, [] as PlaylistEpisodeServerLink[]);

        qualities = uniqueAuthors.map((item) => item);

        for (let index = 0; index < qualities.length; index++) {
          const element = qualities[index];
          console.log(element.url)

        }

        return {
          headers: {},
          links: qualities,
          skipTimes: [],
          subtitles: myJsonObject.tracks
                        .map((element: any) => {
                            if (element["kind"] == "captions") {
                                return {
                                    url: element["file"],
                                    name: element["label"],
                                    format: PlaylistEpisodeServerSubtitleFormat.vtt,
                                    default: element["label"].toLowerCase() == "english",
                                    autoselect: element["label"].toLowerCase() == "english"
                                };
                            } else {
                              return null
                            }
                        })
                        .filter((elements: any) => {
                            return elements != null && elements !== undefined && elements !== "";
                        })
        }
    } else {
      const manifestUrl = myJsonObject.sources[0].file;
      const resResult = (await request.get(manifestUrl)).text();

      let qualities: PlaylistEpisodeServerLink[] = [];
      const resolutions = resResult.split("\\n\\n")[0].match(/(RESOLUTION=)(.*)(\s*?)(\s*.*)/g);
      resolutions?.forEach((res) => {
          const index = manifestUrl.lastIndexOf("/");
          const quality = res.split("\n")[0].split("x")[1].split(",")[0];
          const url = manifestUrl.slice(0, index);
          qualities.push({
              url: url + "/" + res.split("\n")[1].replace("/", ""),
              format: PlaylistEpisodeServerFormatType.hsl,
              quality: quality == "1080" ? PlaylistEpisodeServerQualityType.q1080p : (
                quality == "720" ? PlaylistEpisodeServerQualityType.q720p : (
                  quality == "480" ? PlaylistEpisodeServerQualityType.q480p : PlaylistEpisodeServerQualityType.q360p
                )
              )
          });
      });

      qualities.push({ format: PlaylistEpisodeServerFormatType.hsl, url: manifestUrl, quality: PlaylistEpisodeServerQualityType.auto });

      const uniqueAuthors = qualities.reduce((accumulator, current) => {
          if (!accumulator.find((item) => item.quality === current.quality)) {
              accumulator.push(current);
          }
          return accumulator;
      }, [] as PlaylistEpisodeServerLink[]);

      qualities = uniqueAuthors.map((item) => item);
      for (let index = 0; index < qualities.length; index++) {
        const element = qualities[index];
        console.log(element.url)

      }
      return {
        headers: {},
        links: qualities,
        skipTimes: [],
        subtitles: myJsonObject.tracks
                      .map((element: any) => {
                          if (element["kind"] == "captions") {
                              return {
                                  url: element["file"],
                                  name: element["label"],
                                  format: PlaylistEpisodeServerSubtitleFormat.vtt,
                                  default: element["label"].toLowerCase() == "english",
                                  autoselect: element["label"].toLowerCase() == "english"
                              };
                          } else {
                            return null
                          }
                      })
                      .filter((elements: any) => {
                          return elements != null && elements !== undefined && elements !== "";
                      })
      }
    }
  }
}

const parsePageListing = ($: cheerio.Root): Paging<Playlist> => {
  //const $currentPage = $('div.anime_name.new_series > div > div > ul > li.selected').first();

  //const $prevPage = $currentPage.prev().find("a").attr("data-page");
  //const $nextPage = $currentPage.next().find("a").attr("data-page");

  const items: Playlist[] = [];

  $('.film_list-wrap').children("div").each((_, element) => {
      const id = $(element).find(".film-poster-ahref").first().attr("href");
      const title = $(element).find(".film-name").first().text();
      const image = $(element).find(".film-poster-img").first().attr("data-src");

      // Some links aren't url encoded.
      let encodedImage: string | undefined;

      if (image) encodedImage = encodeURI(image);

      const strippedId = id?.split("?")[0];
      if (strippedId) {
          items.push({
              id: strippedId,
              title: title,
              posterImage: encodedImage,
              url: `${Aniwatch.BASE_URL}${id}`,
              status: PlaylistStatus.completed,
              type: PlaylistType.video
          });
      } 
  });

  return {
      id: "",
      previousPage: undefined,
      nextPage: undefined,
      items: items
  };
};
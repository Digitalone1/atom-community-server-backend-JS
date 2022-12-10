jest.mock("../storage.js");
const getBanList = require("../storage.js").getBanList;

const utils = require("../utils.js");

describe("isPackageNameBanned Tests", () => {
  test("Returns true correctly for banned item", async () => {
    getBanList.mockResolvedValue({ ok: true, content: ["banned-item"] });
    let name = "banned-item";

    let isBanned = await utils.isPackageNameBanned(name);

    expect(isBanned.ok).toBeTruthy();
  });

  test("Returns false correctly for non-banned item", async () => {
    getBanList.mockResolvedValue({ ok: true, content: ["banned-item"] });
    let name = "not-banned-item";

    let isBanned = await utils.isPackageNameBanned(name);

    expect(isBanned.ok).toBeFalsy();
  });

  test("Returns true if no banned list can be retrieved", async () => {
    getBanList.mockResolvedValue({ ok: false });

    let isBanned = await utils.isPackageNameBanned("any");

    expect(isBanned.ok).toBeTruthy();
  });
});

describe("engineFilter returns version expected.", () => {
  test("Returns First Position when given multiple valid positions.", async () => {
    let pack = {
      versions: {
        "2.0.0": {
          version: "2.0.0",
          engines: {
            atom: ">1.0.0 <2.0.0",
          },
        },
        "1.9.9": {
          version: "1.9.9",
          engines: {
            atom: ">1.0.0 <2.0.0",
          },
        },
      },
    };

    let engine = "1.5.0";

    let res = await utils.engineFilter(pack, engine);
    expect(res.metadata.version == "2.0.0");
  });

  test("Returns Matching version when given an equal upper bound.", async () => {
    let pack = {
      versions: {
        "2.0.0": {
          version: "2.0.0",
          engines: {
            atom: ">=1.5.0 <2.0.0",
          },
        },
        "1.9.9": {
          version: "1.9.9",
          engines: {
            atom: ">1.0.0 <=1.4.9",
          },
        },
      },
    };

    let engine = "1.4.9";

    let res = await utils.engineFilter(pack, engine);
    expect(res.metadata.version == "1.9.9");
  });

  test("Returns First Matching version on lower bond equal.", async () => {
    let pack = {
      versions: {
        "2.0.0": {
          version: "2.0.0",
          engines: {
            atom: ">=1.2.3 <2.0.0",
          },
        },
        "1.0.0": {
          version: "1.0.0",
          engines: {
            atom: ">1.0.0 <1.2.3",
          },
        },
      },
    };

    let engine = "1.2.3";

    let res = await utils.engineFilter(pack, engine);
    expect(res.metadata.version == "2.0.0");
  });
});

describe("Tests against semverArray", () => {
  test("Returns valid data back for 1.0.1", () => {
    const ver = "1.0.1";
    const res = utils.semverArray(ver);
    expect(res.length).toEqual(3);
    expect(res[0]).toEqual("1");
    expect(res[1]).toEqual("0");
    expect(res[2]).toEqual("1");
  });
  test("Returns valid data back for 2.4.16", () => {
    const ver = "2.4.16";
    const res = utils.semverArray(ver);
    expect(res.length).toEqual(3);
    expect(res[0]).toEqual("2");
    expect(res[1]).toEqual("4");
    expect(res[2]).toEqual("16");
  });
  test("Returns valid data back for 200.4180.2", () => {
    const ver = "200.4180.2";
    const res = utils.semverArray(ver);
    expect(res.length).toEqual(3);
    expect(res[0]).toEqual("200");
    expect(res[1]).toEqual("4180");
    expect(res[2]).toEqual("2");
  });
  test("Returns invalid data for an invalid string format", () => {
    const ver = " 1.2.3";
    const res = utils.semverArray(ver);
    expect(res).toEqual(null);
  });
  test("Returns invalid data for types different than string", () => {
    const ver = null;
    const res = utils.semverArray(ver);
    expect(res).toEqual(null);
  });
});

describe("Tests against semverGt", () => {
  test("Returns True with Valid data", () => {
    const gVer = ["1", "0", "1"];
    const lVer = ["1", "0", "0"];
    const res = utils.semverGt(gVer, lVer);
    expect(res).toBeTruthy();
  });
  test("Returns True with Valid Data first position", () => {
    const res = utils.semverGt(["2", "0", "0"], ["1", "0", "0"]);
    expect(res).toBeTruthy();
  });
  test("Returns True with Valid Data second position", () => {
    const res = utils.semverGt(["1", "2", "0"], ["1", "1", "0"]);
    expect(res).toBeTruthy();
  });
  test("Returns True with Valid Data third position", () => {
    const res = utils.semverGt(["1", "1", "2"], ["1", "1", "1"]);
    expect(res).toBeTruthy();
  });
  test("Returns false with Valid Data first position", () => {
    const res = utils.semverGt(["1", "0", "0"], ["2", "0", "0"]);
    expect(res).toBeFalsy();
  });
  test("Returns false with Valid Data second position", () => {
    const res = utils.semverGt(["1", "1", "0"], ["1", "2", "0"]);
    expect(res).toBeFalsy();
  });
  test("Returns false with Valid Data thrid position", () => {
    const res = utils.semverGt(["1", "1", "1"], ["1", "1", "2"]);
    expect(res).toBeFalsy();
  });
  test("Returns False with Valid data", () => {
    const ver1 = ["1", "0", "0"];
    const ver2 = ["1", "0", "1"];
    const res = utils.semverGt(ver1, ver2);
    expect(res).toBeFalsy();
  });
});

describe("Tests against semverLt", () => {
  test("Returns true with Valid Data first position", () => {
    const res = utils.semverLt(["0", "0", "9"], ["1", "0", "0"]);
    expect(res).toBeTruthy();
  });
  test("Returns true with Valid Data second position", () => {
    const res = utils.semverLt(["1", "1", "1"], ["1", "2", "1"]);
    expect(res).toBeTruthy();
  });
  test("Returns true with Valid Data third position", () => {
    const res = utils.semverLt(["1", "1", "1"], ["1", "1", "2"]);
    expect(res).toBeTruthy();
  });
  test("Returns false with Valid Data first position", () => {
    const res = utils.semverLt(["2", "0", "0"], ["1", "0", "0"]);
    expect(res).toBeFalsy();
  });
  test("Returns false with Valid Data second position", () => {
    const res = utils.semverLt(["1", "2", "1"], ["1", "1", "0"]);
    expect(res).toBeFalsy();
  });
  test("Returns false with Valid Data third position", () => {
    const res = utils.semverLt(["1", "1", "2"], ["1", "1", "1"]);
    expect(res).toBeFalsy();
  });
});

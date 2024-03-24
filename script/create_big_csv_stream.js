import fs from "fs";

(async () => {
  const filename = "big_stream.csv";
  const init = performance.now();

  const stream = fs.createWriteStream(filename);

  const header = "id,name,age\n";
  stream.write(header);

  for (let i = 0; i < 2e7; i++) {
    const overWatermark = stream.write(`${i},user${i},${Math.floor(Math.random() * 100)}\n`);

    if (!overWatermark) {
      await new Promise((resolve) => {
        stream.once("drain", resolve);
      });
    }
  }

  stream.end();

  console.info(`Time: ${performance.now() - init}ms`);
})()

import fs from "fs";

(() => {
  const filename = "big.csv";
  const init = performance.now();
  let fileData = "id,name,age\n";

  for (let i = 0; i < 2e7; i++) {
    fileData += `${i},user${i},${Math.floor(Math.random() * 100)}\n`;
  }

  fs.writeFileSync(filename, fileData);

  console.info(`Time: ${performance.now() - init}ms`);
})()

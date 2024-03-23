import http from "http"
import express from "express"
import multer from "multer"

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads")
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname)
  },
})

const upload = multer({ storage })

const app = express()
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(express.static("public"))
app.set("view engine", "ejs")
app.set('views', "public");

app.get("/", (_, res) => {
  res.render("index")
})

app.post("/upload", upload.single("file"), (req, res) => {
  console.log(req)
  res.redirect("/detail?filename=" + req.file.originalname)
})

app.get("/detail", (req, res) => {
  const filename = req.query.filename

  res.render("detail", { filename })
})

const server = http.createServer(app)
server.listen(3000, "0.0.0.0", () => {
  console.log("Public Server is running on port 3000")
})

import path from "path";
import CopyPlugin from "copy-webpack-plugin";

const __dirname = path.resolve();

export default {
    mode: "development",
    entry: "./index.js",
    output: {
        path: path.resolve(__dirname, "dist"),
        filename: "index.bundle.js",
        publicPath: '/public',
    },
    target: "node",
    plugins: [
        new CopyPlugin({
            patterns: [
                { from: "./public/*", to: "./public" },
                { from: "./views/*", to: "./views" },
            ],
        }),
    ],
};

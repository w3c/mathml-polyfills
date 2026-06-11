
/* See the file ../../../LICENSE.txt for the LICENSE of this file. */
import HtmlWebpackPlugin from "html-webpack-plugin";

export default {
  entry: "./index.js",
  output: {
    path: import.meta.dirname + "/dist",
    filename: "index_bundle.js",
  },
  plugins: [new HtmlWebpackPlugin()],
};
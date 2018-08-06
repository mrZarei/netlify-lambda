
const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const webpack = require('webpack');
module.exports = {
  entry: {
    main: "./src/index.js"
  },
  output: {
    filename: "etc-stripe-cardelement.js",
    path: path.resolve("dist/client")
  },
  plugins: [
    new webpack.DefinePlugin({
      LAMBDA_ENDPOINT: JSON.stringify(process.env.LAMBDA_ENDPOINT),
      STRIPE_PUBLISHABLE_KEY: JSON.stringify(process.env.STRIPE_PUBLISHABLE_KEY),
    }),
    new HtmlWebpackPlugin({
      template: "./src/index.html"
    })
  ],
  devServer: {
    proxy: {
      "/.netlify": {
        target: "http://localhost:9000",
        pathRewrite: { "^/.netlify/functions": "" }
      }
    }
  }
};
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import webpack from 'webpack';
import { VueLoaderPlugin } from 'vue-loader';

const root = path.dirname(fileURLToPath(import.meta.url));

export default (_env, argv) => ({
  mode: argv.mode ?? 'production',
  target: 'web',
  entry: path.join(root, 'src/index.ts'),
  // 发布包不附带 source map，避免把构建机绝对路径写进可导入 JSON。
  devtool: argv.mode === 'production' ? false : 'eval-source-map',
  experiments: { outputModule: true },
  output: {
    path: path.join(root, 'dist'),
    filename: 'index.js',
    clean: true,
    publicPath: '',
    library: { type: 'module' },
  },
  resolve: { extensions: ['.ts', '.js', '.vue'] },
  module: {
    rules: [
      { resourceQuery: /raw/, type: 'asset/source' },
      { test: /\.vue$/, loader: 'vue-loader', exclude: /node_modules/ },
      {
        test: /\.ts$/,
        loader: 'ts-loader',
        options: { transpileOnly: true, onlyCompileBundledFiles: true },
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ['vue-style-loader', { loader: 'css-loader', options: { url: false } }, 'postcss-loader'],
      },
    ],
  },
  plugins: [
    new VueLoaderPlugin(),
    new webpack.DefinePlugin({
      __VUE_OPTIONS_API__: false,
      __VUE_PROD_DEVTOOLS__: false,
      __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
    }),
  ],
  // Pinia 被本地打入 bundle，因此 feature flags 会被 DefinePlugin 消除。
  // 只有酒馆助手已经提供、且必须与宿主保持同一实例的 Vue 才 external。
  externals: { vue: 'var Vue' },
  optimization: { minimize: argv.mode === 'production' },
});

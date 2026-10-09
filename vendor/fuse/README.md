# Fuse.js vendored dependency

Upstream: https://github.com/krisk/Fuse
Version: 7.1.0 (tag v7.1.0), basic UMD build; downloaded 2026-10-09.
SHA256 (fuse.js): FE7F2BD9960526C0C5D8CCD01464747A15C9884BF3CC7A7FA8A5BBCA1988C361
Source: https://raw.githubusercontent.com/krisk/Fuse/v7.1.0/dist/fuse.basic.js
License: Apache-2.0, LICENSE retained from the same tag. Copyright header retained.
Build file saved as fuse.js without changing its content, so native WeChat CommonJS require can load it. No DOM, workers, npm construction step or remote runtime required for this basic build.

Only service place-search.js uses it. Matches are local catalog suggestions, never automatic changes to planning inputs. Compatibility verified with Node tests and WeChat template/style compilation; real device JS execution still needs acceptance.

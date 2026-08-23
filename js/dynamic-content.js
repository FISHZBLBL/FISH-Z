(function () {
    'use strict';

    var config = window.FISH_Z_CONTENT_CONFIG || {};
    var manifestPromise;

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function cacheKey() {
        return Math.floor(Date.now() / 300000);
    }

    function withVersion(url, version) {
        return url + (url.indexOf('?') === -1 ? '?' : '&') + 'v=' + encodeURIComponent(version || cacheKey());
    }

    function loadScript(url) {
        return new Promise(function (resolve, reject) {
            var script = document.createElement('script');
            script.src = url;
            script.async = true;
            script.onload = function () {
                script.remove();
                resolve();
            };
            script.onerror = function () {
                script.remove();
                reject(new Error('内容文件加载失败'));
            };
            document.head.appendChild(script);
        });
    }

    function loadManifest() {
        if (!manifestPromise) {
            manifestPromise = loadScript(withVersion(config.manifestUrl, cacheKey())).then(function () {
                var manifest = window.FISH_Z_ARTICLES;
                if (!manifest || !Array.isArray(manifest.articles)) {
                    throw new Error('文章清单格式不正确');
                }
                return manifest;
            });
        }
        return manifestPromise;
    }

    function articleUrl(article) {
        return config.articlePath + '?id=' + encodeURIComponent(article.id);
    }

    function category(article) {
        return article.category || '生活随笔';
    }

    function renderHome(root, articles) {
        if (!articles.length) {
            root.innerHTML = '<div class="memory-empty-state"><h2>故事还在路上</h2><p>这里暂时没有已发布的文章。</p></div>';
            return;
        }

        var featured = articles[0];
        var timeline = articles.slice(1).map(function (article) {
            return '<article class="timeline-item">' +
                '<time datetime="' + escapeHtml(article.date) + '"><strong>' + escapeHtml(article.monthDay) + '</strong><span>' + escapeHtml(article.year) + '</span></time>' +
                '<span class="timeline-node" aria-hidden="true"></span>' +
                '<a class="timeline-thumb" href="' + escapeHtml(articleUrl(article)) + '" aria-label="阅读 ' + escapeHtml(article.title) + '"><img src="' + escapeHtml(article.cover) + '" alt=""></a>' +
                '<div class="timeline-copy"><span class="memory-category">' + escapeHtml(category(article)) + '</span>' +
                '<h3><a href="' + escapeHtml(articleUrl(article)) + '">' + escapeHtml(article.title) + '</a></h3>' +
                '<p>' + escapeHtml(article.summary) + '</p></div></article>';
        }).join('');

        root.innerHTML = '<div class="memory-layout"><div class="memory-feature-column">' +
            '<header class="memory-section-heading"><div><span class="memory-kicker">RECENT MEMORIES</span><h1>最新故事</h1></div><i class="far fa-heart memory-heading-mark" aria-hidden="true"></i></header>' +
            '<section class="featured-memory"><div class="featured-memory-copy"><div class="featured-date"><time datetime="' + escapeHtml(featured.date) + '">' + escapeHtml(featured.displayDate) + '</time></div>' +
            '<span class="memory-category">' + escapeHtml(category(featured)) + '</span><h2><a href="' + escapeHtml(articleUrl(featured)) + '">' + escapeHtml(featured.title) + '</a></h2>' +
            '<p>' + escapeHtml(featured.summary) + '</p><a class="memory-read-more" href="' + escapeHtml(articleUrl(featured)) + '">阅读全文 <i class="fas fa-arrow-right" aria-hidden="true"></i></a></div>' +
            '<a class="featured-memory-image" href="' + escapeHtml(articleUrl(featured)) + '" aria-label="阅读 ' + escapeHtml(featured.title) + '"><img src="' + escapeHtml(featured.cover) + '" alt="' + escapeHtml(featured.title) + '"></a></section></div>' +
            '<aside class="memory-timeline" aria-labelledby="timeline-title"><div class="timeline-heading"><div><span class="memory-kicker">FROM THE ARCHIVE</span><h2 id="timeline-title">时光机</h2></div><i class="far fa-clock" aria-hidden="true"></i></div>' +
            '<div class="timeline-list">' + timeline + '</div></aside></div>';
    }

    function showLoadError(root, message) {
        root.innerHTML = '<div class="memory-empty-state"><h2>暂时没能打开</h2><p>' + escapeHtml(message) + '</p><button type="button" class="btn waves-effect memory-retry">重新加载</button></div>';
        var retry = root.querySelector('.memory-retry');
        if (retry) retry.addEventListener('click', function () { window.location.reload(); });
    }

    function initHome() {
        var root = document.querySelector('[data-dynamic-home]');
        if (!root) return;
        loadManifest().then(function (manifest) {
            renderHome(root, manifest.articles);
        }).catch(function (error) {
            showLoadError(root, error.message);
        });
    }

    function highlight(value, keywords) {
        var output = escapeHtml(value);
        keywords.forEach(function (keyword) {
            var escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            output = output.replace(new RegExp(escaped, 'gi'), function (match) {
                return '<em class="search-keyword">' + match + '</em>';
            });
        });
        return output;
    }

    function initSearch() {
        var input = document.getElementById('searchInput');
        var result = document.querySelector('[data-dynamic-search]');
        if (!input || !result) return;

        loadManifest().then(function (manifest) {
            input.addEventListener('input', function () {
                var query = input.value.trim().toLowerCase();
                if (!query) {
                    result.innerHTML = '<div class="search-empty"><i class="far fa-file-alt"></i><span>输入关键词，寻找过去的故事</span></div>';
                    return;
                }
                var keywords = query.split(/\s+/).filter(Boolean);
                var matches = manifest.articles.filter(function (article) {
                    var haystack = [article.title, article.summary, category(article), (article.tags || []).join(' ')].join(' ').toLowerCase();
                    return keywords.every(function (keyword) { return haystack.indexOf(keyword) !== -1; });
                });
                if (!matches.length) {
                    result.innerHTML = '<div class="search-empty"><i class="far fa-meh"></i><span>没有找到相关故事</span></div>';
                    return;
                }
                var items = matches.map(function (article) {
                    return '<li><a href="' + escapeHtml(articleUrl(article)) + '" class="search-result-title">' + highlight(article.title, keywords) + '</a>' +
                        '<p class="search-result">' + highlight(article.summary, keywords) + '</p></li>';
                }).join('');
                result.innerHTML = '<div class="search-count">找到 ' + matches.length + ' 篇文章</div><ul class="search-result-list">' + items + '</ul>';
            });
        }).catch(function () {
            result.innerHTML = '<div class="search-empty"><i class="fas fa-exclamation-circle"></i><span>文章清单暂时无法加载</span></div>';
        });
    }

    function loadArticle(article) {
        window.FISH_Z_ARTICLE = null;
        var isLocal = /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
        var contentUrl = isLocal ? config.localContentBase + encodeURIComponent(article.id) + '.js' : article.contentUrl;
        return loadScript(withVersion(contentUrl, article.version)).then(function () {
            if (!window.FISH_Z_ARTICLE || window.FISH_Z_ARTICLE.id !== article.id) {
                throw new Error('正文文件格式不正确');
            }
            return window.FISH_Z_ARTICLE;
        });
    }

    function initArticle() {
        var root = document.querySelector('[data-dynamic-article]');
        if (!root) return;
        var id = new URLSearchParams(window.location.search).get('id');
        var content = document.getElementById('articleContent');
        if (!id) {
            showLoadError(content, '文章地址缺少 id。');
            return;
        }

        loadManifest().then(function (manifest) {
            var article = manifest.articles.find(function (item) { return item.id === id; });
            if (!article) throw new Error('没有找到这篇文章。');
            document.title = article.title + ' | ' + document.title.split(' | ').pop();
            document.getElementById('dynamicPostTitle').textContent = article.title;
            document.getElementById('dynamicPostDate').textContent = article.displayDate;
            document.getElementById('dynamicPostDate').dateTime = article.date;
            document.getElementById('dynamicPostCategory').textContent = ' · ' + category(article);
            document.getElementById('dynamicPostInfoDate').textContent = article.date.slice(0, 10);
            document.getElementById('dynamicPostWordCount').textContent = article.wordCount;
            document.getElementById('dynamicPostCover').style.backgroundImage = 'url("' + article.cover.replace(/"/g, '%22') + '")';
            return loadArticle(article);
        }).then(function (articleData) {
            content.innerHTML = articleData.html;
            if (window.jQuery && jQuery.fn.lightGallery) {
                jQuery('#articleContent').lightGallery({ selector: 'img' });
            }
        }).catch(function (error) {
            showLoadError(content, error.message);
        });
    }

    function init() {
        initHome();
        initSearch();
        initArticle();
    }

    window.FishZContent = { loadManifest: loadManifest, init: init };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}());



/* globals config, ajaxify */

$(document).ready(function() {
	$(window).on('action:app.load', function() {

		$(window).on('action:composer.topic.new', function(ev, data) {
			if (config['composer-default'].composeRouteEnabled !== 'on') {
				require(['composer'], function(composer) {
					composer.newTopic({
						cid: data.cid,
						title: data.title || '',
						body: data.body || ''
					});
				});
			} else {
				ajaxify.go(
					'compose?cid=' + data.cid +
					(data.title ? '&title=' + encodeURIComponent(data.title) : '') +
					(data.body ? '&body=' + encodeURIComponent(data.body) : '')
				);
			}
		});

		$(window).on('action:composer.post.edit', function(ev, data) {
			if (config['composer-default'].composeRouteEnabled !== 'on') {
				require(['composer'], function(composer) {
					composer.editPost(data.pid);
				});
			} else {
				ajaxify.go('compose?pid=' + data.pid);
			}
		});

		$(window).on('action:composer.post.new', function(ev, data) {
			if (config['composer-default'].composeRouteEnabled !== 'on') {
				require(['composer'], function(composer) {
					composer.newReply(data.tid, data.pid, data.topicName, data.text);
				});
			} else {
				ajaxify.go(
					'compose?tid=' + data.tid +
					(data.pid ? '&toPid=' + data.pid : '') +
					(data.title ? '&title=' + encodeURIComponent(data.topicName) : '') +
					(data.body ? '&body=' + encodeURIComponent(data.text) : '')
				);
			}
		});

		$(window).on('action:composer.addQuote', function(ev, data) {
			if (config['composer-default'].composeRouteEnabled !== 'on') {
				require(['composer'], function(composer) {
					var topicUUID = composer.findByTid(data.tid);
					composer.addQuote(data.tid, data.slug, data.index, data.pid, data.topicName, data.username, data.text, topicUUID);
				});
			} else {
				ajaxify.go('compose?tid=' + data.tid + '&toPid=' + data.pid + '&quoted=1&username=' + data.username);
			}
		});

		$(window).on('action:composer.enhance', function(ev, data) {
			require(['composer'], function(composer) {
				composer.enhance(data.container);
			});
		});

	});

});
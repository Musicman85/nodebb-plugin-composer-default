'use strict';

/*globals define, socket, app*/

define('composer/categoryList', function() {
    var categoryList = {};

    categoryList.init = function(postContainer, postData) {
        var listEl = postContainer.find('.category-list');
        if (!listEl.length) {
            return;
        }

        socket.emit('categories.getCategoriesByPrivilege', 'topics:create', function(err, categories) {
            if (err) {
                return app.alertError(err.message);
            }

            // Remove categories that are just external links
            categories = categories.filter(function(category) {
                return !category.link;
            });

            var categoryMap = {};
            categories.forEach(function(category) {
                category.children = [];
                categoryMap[category.cid] = category;
            });

            categories.forEach(function(category) {
                if (category.parent) {
                    var cid = category.parent.cid;
                    if (!categoryMap[cid]) {
                        categoryMap[cid] = category.parent;
                        categoryMap[cid].noPrivilege = true;
                    }
                    categoryMap[cid].children = categoryMap[cid].children || [];
                    categoryMap[cid].children.push(category);
                }
            });

            categories.length = 0;
            Object.keys(categoryMap).forEach(function(key) {
                if (!categoryMap[key].parent) {
                    categories.push(categoryMap[key]);
                }
            });
            categories = categories.sort(function(a, b) {
                return a.order - b.order;
            });

            categories.forEach(function(category) {
                recursive(category, listEl, '');
            });

            if (postData.cid) {
                listEl.find('option[value="' + postData.cid + '"]').prop('selected', true);
            } else if (postData.hasOwnProperty('cid')) {
                postData.cid = listEl.val();
            }



            /*BEGIN PG-mod
                The category name was not only changing actual composing window, added specific postcontainer
            */
            //$('.category-name').text(listEl.find('option[value="' + postData.cid + '"]').text());
            //$('.category-selector').find('li[data-cid="' + postData.cid + '"]').addClass('active');

             postContainer.find('.category-name').text(listEl.find('option[value="' + postData.cid + '"]').text());
              postContainer.find('.category-selector').find('li[data-cid="' + postData.cid + '"]').addClass('active');
            //END PG-mod

        });

        listEl.on('change', function() {
            if (postData.hasOwnProperty('cid')) {
                postData.cid = this.value;
            }

            $(this).find('[tabindex=' + (parseInt($(this).attr('tabindex'), 10) + 1) + ']').trigger('focus');

           // pgHeaderTitle($('.category-selector').find('li[data-cid="' + postData.cid + '"]').text())
        

        });

        postContainer.find('.category-selector').on('click', 'li', function() {
            postContainer.find('.category-name').text($(this).text());
            postContainer.find('.category-selector').removeClass('open');
            postContainer.find('.category-selector li').removeClass('active');
            $(this).addClass('active');
            postContainer.find('.category-list').val($(this).attr('data-cid'));
        });
        //END PG-mod
    };
    //PG-mod
    function pgHeaderTitle(title) {
      //  $('#pg-category').text(title);
    }
    //END PG-mod


    function recursive(category, listEl, level) {
        if (category.link) {
            return;
        }
        var bullet = level ? '&bull; ' : '';
        $('<option value="' + category.cid + '" ' + (category.noPrivilege ? 'disabled' : '') + '>' + level + bullet + category.name + '</option>').appendTo(listEl);

        $('<li data-cid="' + category.cid + '">' + category.name + '</li>').appendTo($('.category-selector'));

        category.children.sort(function(a, b) {
            return a.order - b.order;
        }).forEach(function(child) {
            recursive(child, listEl, '&nbsp;&nbsp;&nbsp;&nbsp;' + level);
        });
    }

    return categoryList;
});

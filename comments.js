(function () {
  var container = document.querySelector(".comments-section");
  if (!container) return;

  var chapter = container.getAttribute("data-chapter");
  if (!chapter) return;

  // Admin mode: add ?admin to a page's address and enter the key when asked.
  // The key is then remembered in this browser, so it never goes in the
  // address bar (where + and % get altered, and it would sit in history).
  var KEY_STORAGE = "pass-admin-key";
  var adminKey = null;
  try { adminKey = localStorage.getItem(KEY_STORAGE); } catch (_) {}

  var params = new URLSearchParams(window.location.search);
  var askForKey = params.has("admin") && !adminKey;
  if (params.has("admin")) {
    params.delete("admin");
    var query = params.toString();
    history.replaceState(null, "", location.pathname + (query ? "?" + query : "") + location.hash);
  }

  // Render PayPal tip + comments UI
  container.innerHTML =
    '<div class="tip-section">' +
    '  <a href="https://paypal.me/duncansabien/5" class="tip-button" target="_blank" rel="noopener">' +
    '    <svg class="paypal-icon" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">' +
    '      <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797H9.603c-.564 0-1.04.408-1.13.964L7.076 21.337z"/>' +
    '      <path d="M18.429 7.74c-.01.061-.023.122-.035.186-1.06 5.434-4.679 7.314-9.3 7.314H7.381c-.564 0-1.044.408-1.13.964L5.15 22.516a.474.474 0 0 0 .467.548h3.28c.494 0 .914-.357.992-.842l.04-.216.786-4.986.05-.272a1.005 1.005 0 0 1 .992-.842h.625c4.041 0 7.205-1.642 8.128-6.39.386-1.983.186-3.638-.834-4.8a3.959 3.959 0 0 0-1.148-.976z"/>' +
    '    </svg>' +
    '    Send $5 to the author' +
    '  </a>' +
    '</div>' +
    '<h3>Comments</h3>' +
    (askForKey
      ? '<form class="admin-login">' +
        '  <input type="password" name="key" placeholder="Admin key" required autocomplete="current-password">' +
        '  <button type="submit">Enter admin mode</button>' +
        '</form>'
      : '') +
    '<form class="comment-form">' +
    (adminKey ? '  <div class="admin-notice">Admin mode — replies will be tagged as the author. <a href="#" class="admin-exit">Exit admin mode</a></div>' : '') +
    '  <input type="text" name="name" placeholder="Your name" required maxlength="100"' +
    (adminKey ? ' value="Duncan Sabien"' : '') + '>' +
    '  <input type="text" name="website" class="hp-field" tabindex="-1" autocomplete="off" aria-hidden="true">' +
    '  <textarea name="text" placeholder="Leave a comment…" required maxlength="5000" rows="4"></textarea>' +
    '  <button type="submit">Post Comment</button>' +
    '</form>' +
    '<div class="comments-list"></div>';

  var form = container.querySelector(".comment-form");
  var list = container.querySelector(".comments-list");

  var loginForm = container.querySelector(".admin-login");
  if (loginForm) {
    loginForm.addEventListener("submit", function (e) {
      e.preventDefault();
      try {
        localStorage.setItem(KEY_STORAGE, loginForm.querySelector('[name="key"]').value);
      } catch (_) {
        alert("This browser won't let the site remember the admin key (private browsing or blocked site data can cause this).");
        return;
      }
      location.reload();
    });
  }

  var exitLink = container.querySelector(".admin-exit");
  if (exitLink) {
    exitLink.addEventListener("click", function (e) {
      e.preventDefault();
      try { localStorage.removeItem(KEY_STORAGE); } catch (_) {}
      location.reload();
    });
  }

  function adminKeyRejected(message) {
    try { localStorage.removeItem(KEY_STORAGE); } catch (_) {}
    alert(message + " Please enter the admin key again.");
    location.search = "?admin";
  }

  function escapeHtml(s) {
    var div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  function formatDate(iso) {
    var d = new Date(iso);
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }) + " at " + d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function deleteComment(id, el) {
    if (!confirm("Delete this comment? Any replies to it will stay.")) return;
    fetch("/api/comments?id=" + id + "&admin_key=" + encodeURIComponent(adminKey), {
      method: "DELETE",
    })
      .then(function (r) {
        if (r.status === 403) return adminKeyRejected("The admin key wasn't accepted.");
        if (!r.ok) throw new Error("Failed to delete");
        // Its replies move up a level on the server, so redraw the whole list.
        loadComments();
      })
      .catch(function (err) {
        alert("Error: " + err.message);
      });
  }

  // Replies are indented up to this many levels. Replies to the most deeply
  // indented comments line up with them, labelled with who they answer.
  var MAX_DEPTH = 3;

  function renderComment(c, depth, replyingTo) {
    var div = document.createElement("div");
    div.className = "comment" + (c.is_author ? " comment-author-reply" : "") + (depth > 0 ? " comment-reply" : "");
    var authorBadge = c.is_author ? ' <span class="author-badge">Author</span>' : "";
    var deleteBtn = adminKey
      ? ' <button class="comment-delete" title="Delete comment">&times;</button>'
      : "";
    div.innerHTML =
      '<div class="comment-header">' +
      '  <span><strong class="comment-author">' + escapeHtml(c.author_name) + "</strong>" + authorBadge + "</span>" +
      '  <span class="comment-meta">' +
      '    <span class="comment-date">' + formatDate(c.created_at) + "</span>" +
      deleteBtn +
      "  </span>" +
      "</div>" +
      (replyingTo ? '<div class="comment-replying-to">Replying to ' + escapeHtml(replyingTo) + "</div>" : "") +
      '<div class="comment-body">' + escapeHtml(c.comment_text).replace(/\n/g, "<br>") + "</div>" +
      '<div class="comment-actions"><button type="button" class="comment-reply-button">Reply</button></div>' +
      '<div class="comment-replies"></div>';

    if (adminKey) {
      var btn = div.querySelector(".comment-delete");
      if (btn) {
        btn.addEventListener("click", function () {
          deleteComment(c.id, div);
        });
      }
    }
    div.querySelector(".comment-reply-button").addEventListener("click", function () {
      openReplyForm(c, div);
    });
    return div;
  }

  // Draws a comment and, beneath it, its replies, oldest first.
  function renderThread(c, depth, into, childrenOf, replyingTo) {
    var el = renderComment(c, depth, replyingTo);
    into.appendChild(el);
    (childrenOf[c.id] || []).forEach(function (child) {
      if (depth < MAX_DEPTH) {
        renderThread(child, depth + 1, el.querySelector(".comment-replies"), childrenOf, null);
      } else {
        renderThread(child, depth, into, childrenOf, c.author_name);
      }
    });
  }

  function loadComments() {
    fetch("/api/comments?chapter=" + encodeURIComponent(chapter))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        list.innerHTML = "";
        if (!data.comments || data.comments.length === 0) {
          list.innerHTML = '<p class="no-comments">No comments yet. Be the first!</p>';
          return;
        }
        var ids = {};
        var childrenOf = {};
        var topLevel = [];
        data.comments.forEach(function (c) { ids[c.id] = true; });
        data.comments.forEach(function (c) {
          if (c.parent_id && ids[c.parent_id]) {
            (childrenOf[c.parent_id] = childrenOf[c.parent_id] || []).push(c);
          } else {
            topLevel.push(c);
          }
        });
        topLevel.forEach(function (c) {
          renderThread(c, 0, list, childrenOf, null);
        });
      })
      .catch(function () {
        list.innerHTML = '<p class="no-comments">Could not load comments.</p>';
      });
  }

  // Sends a comment from either the main form or a reply form.
  function postComment(fromForm, parentId, onPosted) {
    var btn = fromForm.querySelector('button[type="submit"]');
    var btnLabel = btn.textContent;

    btn.disabled = true;
    btn.textContent = "Posting…";

    var payload = {
      chapter: chapter,
      name: fromForm.querySelector('[name="name"]').value,
      text: fromForm.querySelector('[name="text"]').value,
      website: fromForm.querySelector('[name="website"]').value,
    };
    if (parentId) payload.parent_id = parentId;
    if (adminKey) payload.admin_key = adminKey;

    fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(function (r) {
        if (!r.ok) return r.json().then(function (d) { throw new Error(d.error); });
        return r.json();
      })
      .then(function (data) {
        fromForm.querySelector('[name="text"]').value = "";
        onPosted(data.comment);
        if (adminKey && !data.comment.is_author) {
          adminKeyRejected("The admin key wasn't accepted, so this comment was posted without the Author badge.");
        }
      })
      .catch(function (err) {
        alert("Error posting comment: " + err.message);
      })
      .finally(function () {
        btn.disabled = false;
        btn.textContent = btnLabel;
      });
  }

  // Only one reply form is open at a time; it sits under the comment it answers.
  function openReplyForm(c, commentEl) {
    var open = list.querySelector(".reply-form");
    if (open) {
      var openFor = open.getAttribute("data-parent");
      open.remove();
      if (openFor === String(c.id)) return;
    }

    var replyForm = document.createElement("form");
    replyForm.className = "comment-form reply-form";
    replyForm.setAttribute("data-parent", c.id);
    replyForm.innerHTML =
      '  <input type="text" name="name" placeholder="Your name" required maxlength="100">' +
      '  <input type="text" name="website" class="hp-field" tabindex="-1" autocomplete="off" aria-hidden="true">' +
      '  <textarea name="text" placeholder="Reply to ' + escapeHtml(c.author_name) + '…" required maxlength="5000" rows="3"></textarea>' +
      '  <button type="submit">Post Reply</button>' +
      '  <button type="button" class="reply-cancel">Cancel</button>';
    // Start with whatever name was typed in the main form.
    replyForm.querySelector('[name="name"]').value = form.querySelector('[name="name"]').value;

    replyForm.querySelector(".reply-cancel").addEventListener("click", function () {
      replyForm.remove();
    });
    replyForm.addEventListener("submit", function (e) {
      e.preventDefault();
      form.querySelector('[name="name"]').value = replyForm.querySelector('[name="name"]').value;
      postComment(replyForm, c.id, function () {
        loadComments();
      });
    });

    commentEl.querySelector(".comment-actions").after(replyForm);
    var nameField = replyForm.querySelector('[name="name"]');
    (nameField.value ? replyForm.querySelector("textarea") : nameField).focus();
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    postComment(form, null, function (comment) {
      var noComments = list.querySelector(".no-comments");
      if (noComments) noComments.remove();
      list.appendChild(renderComment(comment, 0, null));
    });
  });

  loadComments();
})();

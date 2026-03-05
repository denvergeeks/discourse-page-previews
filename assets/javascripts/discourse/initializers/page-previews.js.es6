import { withPluginApi } from "discourse/lib/plugin-api";
import { ajax } from "discourse/lib/ajax";
import { later, cancel } from "@ember/runloop";
import { getOwner } from "discourse-common/lib/get-owner";

let previewTimeout = null;
let activePreview = null;
let longPressTimer = null;
let longPressTarget = null;

function initializePagePreviews(api) {
  const siteSettings = api.container.lookup("site-settings:main");
  
  if (!siteSettings.page_previews_enabled) {
    return;
  }

  const requireCtrl = siteSettings.page_previews_require_ctrl_key;
  const hoverDelay = siteSettings.page_previews_hover_delay;
  const mobileEnabled = siteSettings.page_previews_mobile_enabled;
  const longPressDuration = siteSettings.page_previews_mobile_long_press_duration;

  function extractPageId(element) {
    const link = element.closest("a[href*='/pages/'], a[href*='/t/'], a.page-link, a.post-link");
    if (!link) return null;

    const href = link.getAttribute("href");
    
    let match = href.match(/\/pages\/([^\/\?#]+)/);
    if (match) {
      const idOrSlug = match[1];
      if (/^\d+$/.test(idOrSlug)) {
        return parseInt(idOrSlug, 10);
      }
      return link.dataset.pageId ? parseInt(link.dataset.pageId, 10) : null;
    }

    match = href.match(/\/t\/[^\/]+\/(\d+)\/(\d+)/);
    if (match) {
      return parseInt(match[2], 10);
    }

    if (link.dataset.pageId) {
      return parseInt(link.dataset.pageId, 10);
    }
    if (link.dataset.postId) {
      return parseInt(link.dataset.postId, 10);
    }

    return null;
  }

  function createPreviewElement(data) {
    const preview = document.createElement("div");
    preview.className = "page-preview-popup";
    preview.setAttribute("role", "tooltip");

    let html = `
      <div class="page-preview-header">
        <h3 class="page-preview-title">${escapeHtml(data.title)}</h3>
        ${data.type ? `<span class="page-preview-type">${escapeHtml(data.type)}</span>` : ""}
      </div>
    `;

    if (data.image_url && siteSettings.page_previews_show_images) {
      const maxHeight = siteSettings.page_previews_max_image_height;
      html += `
        <div class="page-preview-image">
          <img src="${escapeHtml(data.image_url)}" 
               alt="${escapeHtml(data.title)}"
               style="max-height: ${maxHeight}px;" />
        </div>
      `;
    }

    html += `
      <div class="page-preview-content">
        <p class="page-preview-excerpt">${data.excerpt}</p>
      </div>
    `;

    if (siteSettings.page_previews_show_metadata) {
      html += `
        <div class="page-preview-meta">
          <div class="page-preview-author">
            <img src="${escapeHtml(data.author_avatar)}" 
                 alt="${escapeHtml(data.author_name)}" 
                 class="avatar" />
            <span>${escapeHtml(data.author_name)}</span>
          </div>
      `;

      if (data.read_time) {
        html += `<span class="page-preview-read-time">${data.read_time} min read</span>`;
      }

      if (data.category_name) {
        html += `
          <span class="page-preview-category" 
                style="background-color: #${data.category_color};">
            ${escapeHtml(data.category_name)}
          </span>
        `;
      }

      if (data.tags && data.tags.length > 0) {
        html += `
          <div class="page-preview-tags">
            ${data.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}
          </div>
        `;
      }

      html += `</div>`;
    }

    preview.innerHTML = html;
    return preview;
  }

  function escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  function positionPreview(preview, targetElement) {
    const rect = targetElement.getBoundingClientRect();
    const previewWidth = siteSettings.page_previews_preview_width;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    preview.style.width = `${previewWidth}px`;

    let top = rect.bottom + window.scrollY + 10;
    let left = rect.left + window.scrollX;

    if (left + previewWidth > viewportWidth) {
      left = viewportWidth - previewWidth - 20;
    }
    if (left < 10) {
      left = 10;
    }

    document.body.appendChild(preview);
    const previewHeight = preview.offsetHeight;
    
    if (rect.bottom + previewHeight + 20 > viewportHeight) {
      top = rect.top + window.scrollY - previewHeight - 10;
    }

    preview.style.top = `${top}px`;
    preview.style.left = `${left}px`;
  }

  function showPreview(pageId, targetElement) {
    hidePreview();

    ajax(`/page-previews/${pageId}.json`)
      .then((data) => {
        activePreview = createPreviewElement(data);
        positionPreview(activePreview, targetElement);
        requestAnimationFrame(() => {
          activePreview.classList.add("visible");
        });
      })
      .catch((error) => {
        console.error("Failed to load page preview:", error);
      });
  }

  function hidePreview() {
    if (activePreview) {
      activePreview.remove();
      activePreview = null;
    }
    if (previewTimeout) {
      cancel(previewTimeout);
      previewTimeout = null;
    }
  }

  // Desktop hover (runs on all devices, mobile handles separately)
  document.addEventListener("mouseover", (e) => {
    if (requireCtrl && !e.ctrlKey) {
      return;
    }

    const pageId = extractPageId(e.target);
    if (!pageId) {
      hidePreview();
      return;
    }

    previewTimeout = later(() => {
      showPreview(pageId, e.target);
    }, hoverDelay);
  });

  document.addEventListener("mouseout", (e) => {
    const pageId = extractPageId(e.target);
    if (pageId) {
      hidePreview();
    }
  });

  document.addEventListener("scroll", hidePreview, { passive: true });

  // Mobile long-press (detect via touch events)
  if (mobileEnabled) {
    document.addEventListener("touchstart", (e) => {
      const pageId = extractPageId(e.target);
      if (!pageId) return;

      longPressTarget = e.target;
      longPressTimer = later(() => {
        showPreview(pageId, e.target);
        longPressTimer = null;
      }, longPressDuration);
    }, { passive: true });

    document.addEventListener("touchend", () => {
      if (longPressTimer) {
        cancel(longPressTimer);
        longPressTimer = null;
      }
    }, { passive: true });

    document.addEventListener("touchmove", () => {
      if (longPressTimer) {
        cancel(longPressTimer);
        longPressTimer = null;
      }
      hidePreview();
    }, { passive: true });
  }

  // Composer integration
  if (siteSettings.page_previews_show_in_composer) {
    api.onToolbarCreate((toolbar) => {
      toolbar.addButton({
        id: "insert-page-preview",
        group: "insert",
        icon: "eye",
        title: "page_previews.composer.button_title",
        perform: function (e) {
          const textarea = e?.selected || e?.textarea;
          if (!textarea) return;
          
          const cursorPos = textarea.selectionStart;
          const textBefore = textarea.value.substring(0, cursorPos);
          
          const linkMatch = textBefore.match(/\[([^\]]*)\]\(([^)]*)\)/);
          const template = linkMatch 
            ? `[${linkMatch[1]}](${linkMatch[2]}){.page-preview}`
            : "[Page preview](/pages/page-id){.page-preview}";
          
          const start = textarea.selectionStart;
          textarea.value = textarea.value.substring(0, start) + template + textarea.value.substring(start);
          textarea.selectionStart = textarea.selectionEnd = start + template.length;
          textarea.focus();
        }
      });
    });
  }

  api.onPageChange(() => {
    hidePreview();
  });
}

export default {
  name: "page-previews",
  initialize() {
    withPluginApi("1.8.0", initializePagePreviews);
  },
};

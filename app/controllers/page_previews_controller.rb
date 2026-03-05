# frozen_string_literal: true

module DiscoursePagePreviews
  class PagePreviewsController < ::ApplicationController
    requires_plugin DiscoursePagePreviews::PLUGIN_NAME

    before_action :ensure_logged_in

    def show
      page_id = params[:id].to_i
      
      # Try to find as a page first, then as a post
      page = Page.find_by(id: page_id)
      
      if page
        guardian.ensure_can_preview_page!(page)
        serializer = PagePreviewSerializer.new(page, scope: guardian, root: false)
      else
        # Fallback to post preview
        post = Post.find_by(id: page_id)
        raise Discourse::NotFound unless post
        guardian.ensure_can_preview_post!(post)
        serializer = PagePreviewSerializer.new(post, scope: guardian, root: false, is_post: true)
      end

      render json: serializer
    rescue Discourse::InvalidAccess
      render json: { error: I18n.t("page_previews.errors.no_access") }, status: :forbidden
    rescue Discourse::NotFound
      render json: { error: I18n.t("page_previews.errors.not_found") }, status: :not_found
    end
  end
end

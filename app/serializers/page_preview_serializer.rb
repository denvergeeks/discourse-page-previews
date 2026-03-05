# frozen_string_literal: true

module DiscoursePagePreviews
  class PagePreviewSerializer < ApplicationSerializer
    attributes :id, :title, :excerpt, :created_at, :updated_at, :url, :type
    
    attributes :author_name, :author_avatar, :author_username
    attributes :category_name, :category_color, :tags
    attributes :image_url, :word_count, :read_time
    
    def initialize(object, options = {})
      super
      @is_post = options[:is_post] || false
    end

    def id
      object.id
    end

    def title
      if @is_post
        object.topic.title
      else
        object.title
      end
    end

    def excerpt
      max_length = SiteSetting.page_previews_preview_length
      content = if @is_post
        object.raw
      else
        object.content
      end
      
      # Strip markdown and truncate
      text = PrettyText.excerpt(content, max_length, text_entities: true)
      text
    end

    def created_at
      object.created_at
    end

    def updated_at
      object.updated_at
    end

    def url
      if @is_post
        object.url
      else
        "/pages/#{object.slug}"
      end
    end

    def type
      @is_post ? "post" : "page"
    end

    def author_name
      author.name || author.username
    end

    def author_avatar
      author.avatar_template
    end

    def author_username
      author.username
    end

    def category_name
      return nil unless @is_post
      object.topic.category&.name
    end

    def include_category_name?
      @is_post && object.topic.category.present?
    end

    def category_color
      return nil unless @is_post
      object.topic.category&.color
    end

    def include_category_color?
      @is_post && object.topic.category.present?
    end

    def tags
      return [] unless @is_post
      object.topic.tags.pluck(:name)
    end

    def include_tags?
      @is_post && object.topic.tags.any?
    end

    def image_url
      return nil unless SiteSetting.page_previews_show_images
      
      content = @is_post ? object.cooked : object.content
      
      # Extract first image from content
      doc = Nokogiri::HTML5.fragment(content)
      img = doc.css("img").first
      
      img&.attr("src")
    end

    def include_image_url?
      SiteSetting.page_previews_show_images && image_url.present?
    end

    def word_count
      content = @is_post ? object.raw : object.content
      content.scan(/\w+/).size
    end

    def include_word_count?
      SiteSetting.page_previews_show_metadata
    end

    def read_time
      # Estimate reading time (average 200 words per minute)
      (word_count / 200.0).ceil
    end

    def include_read_time?
      SiteSetting.page_previews_show_metadata
    end

    private

    def author
      @author ||= if @is_post
        object.user
      else
        object.user
      end
    end
  end
end

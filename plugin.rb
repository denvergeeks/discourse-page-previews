# frozen_string_literal: true

# name: discourse-page-previews
# about: Adds hover previews for pages and posts with Ctrl+hover support
# version: 1.0.0
# authors: Jen Story
# url: https://github.com/yourusername/discourse-page-previews
# required_version: 3.1.0

enabled_site_setting :page_previews_enabled

register_asset "stylesheets/page-previews.scss"

after_initialize do
  module ::DiscoursePagePreviews
    PLUGIN_NAME = "discourse-page-previews"

    class Engine < ::Rails::Engine
      engine_name PLUGIN_NAME
      isolate_namespace DiscoursePagePreviews
    end
  end

  require_relative "app/controllers/page_previews_controller"
  require_relative "app/serializers/page_preview_serializer"

  DiscoursePagePreviews::Engine.routes.draw do
    get "/page-previews/:id" => "page_previews#show", constraints: { id: /\d+/ }
  end

  Discourse::Application.routes.append do
    mount ::DiscoursePagePreviews::Engine, at: "/"
  end

  # Add guardian method for preview access
  add_to_class(:guardian, :can_preview_page?) do |page|
    return false unless SiteSetting.page_previews_enabled
    return false unless authenticated?
    return false if page.blank?
    return false unless page.respond_to?(:topic)
    
    # Check if user can see the topic
    can_see_topic?(page.topic)
  end

  add_to_class(:guardian, :can_preview_post?) do |post|
    return false unless SiteSetting.page_previews_enabled
    return false unless authenticated?
    return false if post.blank?
    
    # Check if user can see the post
    can_see_post?(post)
  end
end

# It's Time to Migrate from usememos to Rote

> On December 28th of last year, I wrote an article introducing Rote, which received some attention. The GitHub repository stars have risen to over 800+ today. The constantly growing number of stars makes me very excited, and correspondingly, I have invested more time and thought into the Rote project.

Since then, when people ask me offline what I am doing, I tell them I am working on Rote, a note-taking software like a social media circle.

I am no longer ashamed to speak of it as before, because Rote is a different kind of note-taking software. It carries my philosophy and thoughts on notes, as well as my aesthetic preferences. It is excellent enough in my eyes.

Functionally, I am not a person who likes to take notes. Compared to building a cold knowledge base, I prefer to share things I am interested in with friends, or share my daily life in my social circle. The interaction and sharing between people make me feel happy. I am not a person who can live in isolation.

What I like most about Rote is that notes can be public. There is a [homepage](https://rote.ink/rabithua) that belongs to you and can be accessed by anyone. And as you can see, you can interact with emojis, but there is no comment function. I think reactions are just right (if there were comments, it would feel a bit nondescript. You can just come and see what I share; we don't need to discuss it).

![rabithua.png](https://r2.rote.ink/users/dbde41e2-6508-4028-9b5b-4cc15c891a47/compressed/87bdcd83-1631-44a0-9e8f-c855d63f5741.webp)

> Rote is a note-taking app, I need to remind myself constantly

![note_1.png](https://r2.rote.ink/users/dbde41e2-6508-4028-9b5b-4cc15c891a47/compressed/7b185b2a-b966-45bc-891b-c6f82c51d67c.webp)

### Thoughts on Markdown

I have repeatedly emphasized that Rote will not support Markdown syntax. I have long felt that for most people, taking notes in a rich format and exquisite layout like writing an article is a very heavy behavior. These complex decorations make note-taking complex and stressful, thereby reducing the desire to take notes. Recording is more important than recording well. This is also my original intention to insist on not supporting syntax in the main input box.

However, I also made a compromise. Actually, it's not really a compromise; everything is just going with the flow.

I added an article citation button in the small icon below the editor. After opening it, you can edit or select saved articles to cite.

This is to cope with the few scenarios where Markdown syntax is indeed needed. For example, some time ago I wrote a note to record some SwiftUI Liquid Glass usage tips. The code snippets in it needed Markdown to render to ensure readability.

![editor.png](https://r2.rote.ink/users/dbde41e2-6508-4028-9b5b-4cc15c891a47/compressed/b3a4f91c-e392-480d-a33b-692f4dded0e0.webp)

_Supporting the Markdown article function with minimal disturbance_

### As an Old-School RSS Enthusiast

As you can see, there is an RSS button in the sidebar of my web homepage image. Clicking it jumps directly to the RSS page of my notes.

![rabithua.png](https://r2.rote.ink/users/dbde41e2-6508-4028-9b5b-4cc15c891a47/compressed/87bdcd83-1631-44a0-9e8f-c855d63f5741.webp)

In my opinion, RSS is a very good thing. I can easily subscribe to the content I care about. I think all information streams should support RSS. Although it is a bit idealistic, this is the original intention of the Internet being invented, rather than like now where many platforms trap users' public thoughts and content in one place.

#### Besides the Explore page and each user's notes being RSS-able, there is also...

![rssbot.png](https://r2.rote.ink/users/dbde41e2-6508-4028-9b5b-4cc15c891a47/compressed/8db88cbb-c1bb-45c8-888e-f99cec4a4fda.webp)

This is simply a genius idea. The meaning of the Explore page is to explore content that others think is worth sharing.
I also often look at the Rote Explore page to see what everyone is sharing, although most of it is still interesting content shared by myself. So if I connect the content of my usual RSS subscriptions to Rote, it would be a matter of course!

One afternoon when inspiration struck, I completed the construction of the RoteFeeder repository.

![rotefeeder.png](https://r2.rote.ink/users/dbde41e2-6508-4028-9b5b-4cc15c891a47/compressed/04c20e7a-508c-4183-854e-32baa2d84363.webp)

**Paired with Rote's OpenKey, you can easily deploy a service to forward your RSS subscription content to Rote.**

My approach is to create a new [account used to carry RSS content](https://rote.ink/RoteFeeder). Rote's multi-user design can naturally be used to distinguish content from different sources.

Now you don't need to open your RSS software anymore. Use RoteFeeder. Just like Rote, its deployment process is as simple as drinking water. A single docker-compose.yml can get it done. For details, please see the [repository readme](https://github.com/Rabithua/RoteFeeder).

### It's Time to Migrate from usememos to Rote

> If you agree with my thoughts and are using usememos to host your notes, I am happy to introduce a small tool to you.

![rerote.png](https://r2.rote.ink/users/dbde41e2-6508-4028-9b5b-4cc15c891a47/compressed/791513d7-e4a4-41aa-9e0a-106de18eaeb7.webp)

Tool address: https://rerote.vercel.app
Tool repository address: https://github.com/Rabithua/Rerote

You can easily use the Rerote tool to convert data from other note-taking platforms to the structure required by Rote and download it. After downloading, import the data via the data import tool in Rote's experiment page.

![import.png](https://r2.rote.ink/users/dbde41e2-6508-4028-9b5b-4cc15c891a47/compressed/57fcbeaf-c442-4f98-9d14-3b237837c274.webp)

### One More Thing

If you have already started using Rote, don't forget to download Rote's iOS App!
https://apps.apple.com/us/app/rote/id6755513897?l=en-US

![ios.png](https://r2.rote.ink/users/dbde41e2-6508-4028-9b5b-4cc15c891a47/compressed/5fb2c8d1-4f98-44b0-ab2c-06699c259218.webp)

**You can repeatedly click on the welcome text on the login page to trigger the custom API and use your own deployed service!**

**[Demo](https://demo.rote.ink/)** ｜ **[Website](https://rote.ink)** ｜ **[iOS APP](https://apps.apple.com/us/app/rote/id6755513897)** ｜ **[Explore](https://rote.ink/explore)** ｜ **[Rabithua](https://rote.ink/rabithua)**

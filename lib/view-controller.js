const { getLatest, render } = require('./')
const { APP_NAME, REPO_PATH, downloads } = require('../constants')
const marky = require('marky-markdown')
const semver = require('semver')
const moment = require('moment')

function getDownloadLinks (release, version) {
  const asstesFiles = release.assets && release.assets.map(asset => asset.name.toLowerCase())

  const links = downloads
    .filter(download => {
      return asstesFiles.find(asset => asset.includes(download.extension.toLowerCase()))
    })
    .map(download => {
      const { platform, extension } = download
      const downloadPath = version === 'latest' ? `/latest/${extension}` : `/releases/${version}/${extension}`

      const link = render('a', { href: downloadPath, title: `Download ${APP_NAME} for ${platform}` }, downloadPath)
      const name = render('b', null, platform)
      const hint = render('i', null, `(${extension})`)
      return render('li', null, `${name} ${hint}: ${link}`)
    })

  return render('ul', null, links)
}

function downloadsView (req, res, { release, isLatestVersion }) {
  const version = isLatestVersion ? 'latest' : release.tag_name
  const links = getDownloadLinks(release, version)

  const repoLink = render('a', { class: 'a--repolink', href: `https://github.com/${REPO_PATH}` }, REPO_PATH)
  const versionTag = render('span', { class: 'tag' }, release.tag_name)

  const releaseNotesHref = isLatestVersion ? '/release' : `/release/${version}`
  const releaseNotesLink = render('a', { class: 'a--changelog', href: releaseNotesHref }, [versionTag, 'Release notes'])
  const githubLink = render('a', { class: 'a--changelog a--shade', href: `https://github.com/${REPO_PATH}` }, 'Github')
  const versionsLink = render('a', { class: 'a--changelog a--shade', href: '/versions' }, 'All versions')

  const content = [
    links,
    render('div', { class: 'flex' }, [releaseNotesLink, versionsLink, githubLink])
  ].join(render('br'))

  return [
    render('h2', null, repoLink),
    content
  ].join('')
}

const isMilestone = (tagName) => semver.valid(tagName) && semver.minor(tagName) === 0 && semver.patch(tagName) === 0

async function versionsView (req, res, releases) {
  const latestRelease = getLatest(releases)

  const links = releases.map(release => {
    const href = `/versions/${release.tag_name}`

    const latestTag = release.tag_name === latestRelease.tag_name ? '(latest)' : ''
    const milestone = isMilestone(release.tag_name) ? '🎉' : ''

    const date = renderDate(release.published_at)

    return render('div', null, [
      render('a', { href }, render('b', null, `${release.tag_name} ${latestTag}`)),
      render('span', null, milestone),
      render('span', null, ` - ${date}`)
    ])
  })

  return [
    render('h2', null, 'Releases'),
    ...links
  ].join(render('br'))
}

function renderDate (date) {
  return moment(date).fromNow()
}

function repoHeader () {
  const [organizationName, repoName] = REPO_PATH.split('/')

  return [
    render('span', { class: 'repo repo--org' }, organizationName),
    render('span', { class: 'repo repo--separator' }, '/'),
    render('span', { class: 'repo repo--name' }, repoName)
  ].join('')
}

function releaseView (req, res, { release, isLatestVersion }) {
  const version = isLatestVersion ? 'latest' : release.tag_name
  const versionTag = render('span', { class: 'tag' }, release.tag_name)
  const latestTag = isLatestVersion ? render('i', null, '(latest)') : ''

  const markdown = marky(release.body)

  return [
    render('h2', null, `${versionTag} ${repoHeader()} ${latestTag} release notes`),
    render('div', null, markdown),
    render('br'),
    render('h3', null, render('a', { href: '#downloads', class: 'a--relative' }, `Downloads`)),
    render('div', { id: 'downloads' }, getDownloadLinks(release, version)),
    render('br'),
    render('br')
  ].join('')
}

module.exports = async function viewController (req, res, { version, releases, cache }) {
  const isLatestVersion = version === 'latest'

  if (version) {
    const latestRelease = getLatest(releases)
    const release = isLatestVersion ? latestRelease : releases.find(release => release.tag_name === version)
    return releaseView(req, res, { release, isLatestVersion: latestRelease.tag_name === release.tag_name })
  }

  if (req.url.startsWith('/versions')) return versionsView(req, res, releases)
  if (req.url.startsWith('/releases')) return versionsView(req, res, releases)
  if (req.url.startsWith('/release')) return releaseView(req, res, { release: getLatest(releases), isLatestVersion: true })
  if (req.url.startsWith('/stats')) {
    const stats = cache.stats()
    return stats
  }

  return downloadsView(req, res, { release: getLatest(releases), isLatestVersion: true })
}

-- Create packages TABLE

CREATE EXTENSION pgcrypto;

CREATE TYPE packageType AS ENUM('package', 'theme');

CREATE TABLE packages (
    pointer UUID DEFAULT GEN_RANDOM_UUID() PRIMARY KEY,
    name VARCHAR(128) NOT NULL UNIQUE,
    package_type packageType NOT NULL,
    created TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    creation_method VARCHAR(128),
    downloads BIGINT NOT NULL DEFAULT 0,
    stargazers_count BIGINT NOT NULL DEFAULT 0,
    original_stargazers BIGINT NOT NULL DEFAULT 0,
    data JSONB,
    -- constraints
    CONSTRAINT lowercase_names CHECK (name = LOWER(name))
);

CREATE FUNCTION now_on_updated_package()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_now_on_updated
    BEFORE UPDATE ON packages
    FOR EACH ROW
EXECUTE PROCEDURE now_on_updated_package();

-- Create names Table

CREATE TABLE names (
    name VARCHAR(128) NOT NULL PRIMARY KEY,
    pointer UUID NULL,
    -- constraints
    CONSTRAINT lowercase_names CHECK (name = LOWER(name)),
    CONSTRAINT package_names_fkey FOREIGN KEY (pointer) REFERENCES packages(pointer) ON DELETE SET NULL
);

-- Create users Table

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    username VARCHAR(256) NOT NULL UNIQUE,
    node_id VARCHAR(256) UNIQUE,
    avatar VARCHAR(100),
    data JSONB
);

-- Create stars Table

CREATE TABLE stars (
    package UUID NOT NULL REFERENCES packages(pointer),
    userid INTEGER NOT NULL REFERENCES users(id),
    PRIMARY KEY (package, userid)
);

-- Create versions Table

CREATE TYPE versionStatus AS ENUM('latest', 'published', 'removed');
CREATE TYPE repository AS ENUM('git');

CREATE TABLE versions (
    id SERIAL PRIMARY KEY,
    package UUID NOT NULL REFERENCES packages(pointer),
    status versionStatus NOT NULL,
    semver VARCHAR(256) NOT NULL,
    license VARCHAR(128) NOT NULL,
    engine JSONB NOT NULL,
    repo_type repository NOT NULL DEFAULT 'git',
    repo_url TEXT NOT NULL DEFAULT '',
    readme TEXT NOT NULL DEFAULT '',
    created TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    meta JSONB,
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    -- generated columns
    semver_v1 INTEGER GENERATED ALWAYS AS
        (CAST ((regexp_match(semver, '^(\d+)\.(\d+)\.(\d+)'))[1] AS INTEGER)) STORED,
    semver_v2 INTEGER GENERATED ALWAYS AS
        (CAST ((regexp_match(semver, '^(\d+)\.(\d+)\.(\d+)'))[2] AS INTEGER)) STORED,
    semver_v3 INTEGER GENERATED ALWAYS AS
        (CAST ((regexp_match(semver, '^(\d+)\.(\d+)\.(\d+)'))[3] AS INTEGER)) STORED,
    -- constraints
    CONSTRAINT semver2_format CHECK (semver ~ '^\d+\.\d+\.\d+'),
    CONSTRAINT unique_pack_version UNIQUE(package, semver)
);

CREATE TRIGGER trigger_now_on_updated_versions
    BEFORE UPDATE ON versions
    FOR EACH ROW
EXECUTE PROCEDURE now_on_updated_package();

-- Create authstate Table

CREATE TABLE authstate (
    id UUID DEFAULT GEN_RANDOM_UUID() PRIMARY KEY,
    keycode VARCHAR(256) NOT NULL UNIQUE,
    created TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

------------------------------------------------------------------------------

-- Enter our Test data into the Database.

INSERT INTO packages (pointer, package_type, name, creation_method, downloads, stargazers_count, data, original_stargazers)
VALUES (
  'd28c7ce5-c9c4-4fb6-a499-a7c6dcec355b', 'package', 'language-css', 'user made', 400004, 1, '{}', 76
), (
  'd27dbd37-e58e-4e02-b804-9e3e6ae02fb1', 'package', 'language-cpp', 'user made', 849156, 1, '{}', 91
), (
  'ee87223f-65ab-4a1d-8f45-09fcf8e64423', 'package', 'hydrogen', 'Migrated from Atom.io', 2562844, 1, '{}', 821
), (
  'aea26882-8459-4725-82ad-41bf7aa608c3', 'package', 'atom-clock', 'Migrated from Atom.io', 1090899, 1, '{}', 528
), (
  '1e19da12-322a-4b37-99ff-64f866cc0cfa', 'package', 'hey-pane', 'Migrated from Atom.io', 206804, 1, '{}', 176
), (
  'a0ef01cb-720e-4c0d-80c5-f0ed441f31fc', 'theme', 'atom-material-ui', 'Migrated from Atom.io', 2509605, 1, '{}', 1772
), (
  '28952de5-ddbf-41a8-8d87-5d7e9d7ad7ac', 'theme', 'atom-material-syntax', 'Migrated from Atom.io', 1743927, 1, '{}', 1309
);

INSERT INTO names (name, pointer)
VALUES (
  'language-css', 'd28c7ce5-c9c4-4fb6-a499-a7c6dcec355b'
), (
  'language-cpp', 'd27dbd37-e58e-4e02-b804-9e3e6ae02fb1'
), (
  'hydrogen', 'ee87223f-65ab-4a1d-8f45-09fcf8e64423'
), (
  'atom-clock', 'aea26882-8459-4725-82ad-41bf7aa608c3'
), (
  'hey-pane', '1e19da12-322a-4b37-99ff-64f866cc0cfa'
), (
  'atom-material-ui', 'a0ef01cb-720e-4c0d-80c5-f0ed441f31fc'
), (
  'atom-material-syntax', '28952de5-ddbf-41a8-8d87-5d7e9d7ad7ac'
);

INSERT INTO versions (package, status, semver, license, engine, created, repo_url, readme, meta)
VALUES (
  'd28c7ce5-c9c4-4fb6-a499-a7c6dcec355b', 'published', '0.45.7', 'MIT', '{"atom": "*", "node": "*"}', '2023-02-01 12:00:00', 'https://github.com/pulsar-edit/language-css', 'THIS IS A README',
  '{"name": "language-css", "description": "CSS Support in Atom", "keywords": ["tree-sitter"],
    "tarball_url": "https://github.com/pulsar-edit/language-css",
    "sha": "570CC7A82B4807E15CFC4835A50802FD4BC84456"}'
), (
  'd28c7ce5-c9c4-4fb6-a499-a7c6dcec355b', 'latest', '0.46.0', 'MIT', '{"atom": "*", "node": "*"}', '2023-02-01 12:01:00', 'https://github.com/pulsar-edit/language-css', 'THIS IS A README',
  '{"name": "language-css", "description": "CSS Support in Atom", "keywords": ["tree-sitter"],
    "tarball_url": "https://github.com/pulsar-edit/language-css",
    "sha": "570CC7A82B4807E15CFC4835A50802FD4BC84456"}'
), (
  'd28c7ce5-c9c4-4fb6-a499-a7c6dcec355b', 'published', '0.45.0', 'MIT', '{"atom": "*", "node": "*"}', '2023-02-01 12:02:00', 'https://github.com/pulsar-edit/language-css', 'THIS IS A README',
  '{"name":"language-css", "description": "CSS Support in Atom", "keywords": ["tree-sitter"],
    "tarball_url": "https://github.com/pulsar-edit/language-css",
    "sha": "570CC7A82B4807E15CFC4835A50802FD4BC84456"}'
), (
  'd27dbd37-e58e-4e02-b804-9e3e6ae02fb1', 'published', '0.11.8', 'MIT', '{"atom": "*", "node": "*"}', '2023-02-01 12:02:00', 'https://github.com/pulsar-edit/language-cpp', 'THIS IS A README',
  '{"name": "language-cpp", "description": "C++ Support in Atom", "keywords": ["tree-sitter"],
    "tarball_url": "https://github.com/pulsar-edit/language-cpp",
    "sha": "570CC7A82B4807E15CFC4835A50802FD4BC84456"}'
), (
  'd27dbd37-e58e-4e02-b804-9e3e6ae02fb1', 'latest', '0.11.9', 'MIT', '{"atom": "*", "node": "*"}', '2023-02-01 12:03:00', 'https://github.com/pulsar-edit/language-cpp', 'THIS IS A README',
  '{"name": "language-cpp", "description": "C++ Support in Atom", "keywords": ["tree-sitter"],
    "tarball_url": "https://github.com/pulsar-edit/language-cpp",
    "sha": "570CC7A82B4807E15CFC4835A50802FD4BC84456"}'
), (
  'ee87223f-65ab-4a1d-8f45-09fcf8e64423', 'latest', '2.16.3', 'MIT', '{"atom": "*"}', '2023-02-01 12:04:00',
  'https://www.atom.io/api/packages/hydrogen/version/2.16.3/tarball', 'THIS IS A README',
  '{"name": "hydrogen",
    "dist": {"tarball": "https://www.atom.io/api/packages/hydrogen/version/2.16.3/tarball"},
    "tarball_url": "https://www.atom.io/api/packages/hydrogen/version/2.16.3/tarball",
    "sha": "570CC7A82B4807E15CFC4835A50802FD4BC84456"}'
), (
  'aea26882-8459-4725-82ad-41bf7aa608c3', 'latest', '0.1.18', 'MIT', '{"atom": "*"}', '2023-02-01 12:05:00',
  'https://www.atom.io/api/packages/atom-clock/version/1.18.0/tarball', 'THIS IS A README',
  '{"name": "atom-clock",
    "dist": {"tarball": "https://www.atom.io/api/packages/atom-clock/version/1.18.0/tarball"},
    "tarball_url": "https://www.atom.io/api/packages/atom-clock/version/1.18.0/tarball",
    "sha": "570CC7A82B4807E15CFC4835A50802FD4BC84456"}'
), (
  '1e19da12-322a-4b37-99ff-64f866cc0cfa', 'latest', '1.2.0', 'MIT', '{"atom": "*"}', '2023-02-01 12:06:00',
  'https://www.atom.io/api/packages/hey-pane/version/1.2.0/tarball', 'THIS IS A README',
  '{"name":"hey-pane",
    "dist": {"tarball": "https://www.atom.io/api/packages/hey-pane/version/1.2.0/tarball"},
    "tarball_url": "https://www.atom.io/api/packages/hey-pane/version/1.2.0/tarball",
    "sha": "570CC7A82B4807E15CFC4835A50802FD4BC84456"}'
), (
  'a0ef01cb-720e-4c0d-80c5-f0ed441f31fc', 'latest', '2.1.3', 'MIT', '{"atom": "*"}', '2023-02-01 12:07:00',
  'https://www.atom.io/api/packages/atom-material-ui/version/2.1.3/tarball', 'THIS IS A README',
  '{"name": "atom-material-ui",
    "dist": {"tarball": "https://www.atom.io/api/packages/atom-material-ui/version/2.1.3/tarball"},
    "tarball_url": "https://www.atom.io/api/packages/atom-material-ui/version/2.1.3/tarball",
    "sha": "570CC7A82B4807E15CFC4835A50802FD4BC84456"}'
), (
  '28952de5-ddbf-41a8-8d87-5d7e9d7ad7ac', 'latest', '1.0.8', 'MIT', '{"atom":"*"}', '2023-02-01 12:08:00',
  'https://www.atom/io/api/packages/atom-material-syntax/version/1.0.8/tarball', 'THIS IS A README',
  '{"name": "atom-material-syntax",
    "dist": {"tarball":"https://www.atom/io/api/packages/atom-material-syntax/version/1.0.8/tarball"},
    "tarball_url": "https://www.atom/io/api/packages/atom-material-syntax/version/1.0.8/tarball",
    "sha": "570CC7A82B4807E15CFC4835A50802FD4BC84456"}'
);

INSERT INTO users (username, node_id, avatar)
VALUES (
  'dever', 'dever-nodeid', 'https://roadtonowhere.com'
), (
  'no_perm_user', 'no-perm-user-nodeid', 'https://roadtonowhere.com'
), (
  'admin_user', 'admin-user-nodeid', 'https://roadtonowhere.com'
), (
  'has-no-stars', 'has-no-stars-nodeid', 'https://roadtonowhere.com'
), (
  'has-all-stars', 'has-all-stars-nodeid', 'https://roadtonowhere.com'
);

INSERT INTO stars (package, userid)
VALUES (
  'd28c7ce5-c9c4-4fb6-a499-a7c6dcec355b', 5
), (
  'd27dbd37-e58e-4e02-b804-9e3e6ae02fb1', 5
), (
  'ee87223f-65ab-4a1d-8f45-09fcf8e64423', 5
), (
  'aea26882-8459-4725-82ad-41bf7aa608c3', 5
), (
  '1e19da12-322a-4b37-99ff-64f866cc0cfa', 5
), (
  'a0ef01cb-720e-4c0d-80c5-f0ed441f31fc', 5
), (
  '28952de5-ddbf-41a8-8d87-5d7e9d7ad7ac', 5
);

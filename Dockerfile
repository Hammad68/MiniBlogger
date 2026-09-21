# syntax=docker/dockerfile:1

# Comments are provided throughout this file to help you get started.
# If you need more help, visit the Dockerfile reference guide at
# https://docs.docker.com/go/dockerfile-reference/

# Want to help us make this template better? Share your feedback here: https://forms.gle/ybq9Krt8jtBL3iCk7

ARG NODE_VERSION=20.20.2

FROM node:${NODE_VERSION}-alpine

# Use production node environment by default.
ENV NODE_ENV production


WORKDIR /usr/src/app

# Copy the package.json and package-lock.json files into the image.
COPY package*.json ./

# Clean install the dependencies, omitting dev dependencies for production.
RUN npm ci --omit=dev

# Copy the rest of the source files into the image.
COPY . .

# Create the data folder where the SQLite database will be stored. And grant the non-root user permission to write to it.
RUN mkdir -p /usr/src/app/data && chown -R node:node /usr/src/app/data

# Run the application as a non-root user.
USER node


# Expose the port that the application listens on.
EXPOSE 3000

# Run the application.
CMD npm start